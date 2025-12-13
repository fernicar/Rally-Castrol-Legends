# Rally Legends - Gamepad Support Integration Plan

## Overview
This document outlines the implementation plan for adding Xbox One / Xbox-style gamepad support to Rally Castrol Legends. The game currently uses keyboard input (WASD/Arrows + Space) and this update will add full gamepad support while maintaining keyboard compatibility.

## Current Input System Analysis

### Existing Implementation
- **Input Handler**: Ref-based input state in `GameEngine.tsx`
- **Input Structure**: Boolean flags for each control
  ```typescript
  inputsRef.current = {
    up: false,      // W / Arrow Up - Accelerate
    down: false,    // S / Arrow Down - Brake/Reverse
    left: false,    // A / Arrow Left - Turn Left
    right: false,   // D / Arrow Right - Turn Right
    space: false    // Space - Handbrake/Drift
  }
  ```
- **Event System**: `keydown` and `keyup` event listeners
- **Input Frequency**: Read every frame in main game loop

### Advantages of Current System
- Simple boolean state makes it easy to extend
- Ref-based means no React re-renders
- Direct mapping to game actions
- Already supports simultaneous inputs (e.g., accelerate + turn)

## Gamepad API Implementation Strategy

### 1. Gamepad Detection & Connection
**Web Gamepad API** provides native browser support for controllers:
- **Detection**: `navigator.getGamepads()` - returns array of connected gamepads
- **Events**: 
  - `gamepadconnected` - fired when controller connects
  - `gamepaddisconnected` - fired when controller disconnects
- **Polling**: Gamepad state must be polled each frame (not event-driven)

### 2. Xbox One Controller Mapping (Standard Layout)

#### Button Indices (Standard Gamepad Mapping)
```javascript
0  - A Button (Face Button Down) → Accelerate
1  - B Button (Face Button Right) → Brake/Reverse  
2  - X Button (Face Button Left) → [Reserved/Unused]
3  - Y Button (Face Button Up) → [Reserved/Unused]
4  - LB (Left Bumper) → [Reserved/Alternative Handbrake]
5  - RB (Right Bumper) → [Reserved/Alternative Handbrake]
6  - LT (Left Trigger Digital) → Brake (Digital fallback)
7  - RT (Right Trigger Digital) → Accelerate (Digital fallback)
8  - Back/View Button → [Menu/Pause]
9  - Start/Menu Button → [Menu/Pause]
10 - Left Stick Click (L3) → [Reserved]
11 - Right Stick Click (R3) → [Reserved]
12 - D-pad Up → Accelerate (Alternative)
13 - D-pad Down → Brake (Alternative)
14 - D-pad Left → Turn Left (Alternative)
15 - D-pad Right → Turn Right (Alternative)
```

#### Analog Axes (Standard Gamepad Mapping)
```javascript
0 - Left Stick X-axis → Steering (-1.0 left, +1.0 right)
1 - Left Stick Y-axis → [Unused or Camera]
2 - Right Stick X-axis → [Unused or Camera]
3 - Right Stick Y-axis → [Unused or Camera]
4 - RT (Right Trigger) Analog → Accelerate (0.0 - 1.0)
5 - LT (Left Trigger) Analog → Brake (0.0 - 1.0)
```

### 3. Control Scheme Design

#### Primary Controls
- **Left Stick X-Axis** → Steering (analog input)
- **RT (Right Trigger)** → Accelerate (analog input)
- **LT (Left Trigger)** → Brake/Reverse (analog input)
- **A Button (or RB/LB)** → Handbrake/Drift (digital)

#### Alternative/Fallback Controls
- **D-pad** → Digital steering and acceleration (like keyboard)
- **Face Buttons (A/B)** → Digital acceleration/braking

#### Deadzone Configuration
- **Steering Deadzone**: 0.15 (ignore small stick movements)
- **Trigger Deadzone**: 0.05 (minimal deadzone for triggers)
- **Analog to Digital Threshold**: 0.5 (when analog acts as digital)

## Implementation Plan

### Phase 1: Core Gamepad Infrastructure
**Files to Modify**: `components/GameEngine.tsx`

#### 1.1 Add Gamepad State Management
```typescript
const gamepadRef = useRef<{
  connected: boolean;
  index: number;
  lastTimestamp: number;
}>({
  connected: false,
  index: -1,
  lastTimestamp: 0
});
```

#### 1.2 Implement Gamepad Connection Detection
```typescript
useEffect(() => {
  const handleGamepadConnected = (e: GamepadEvent) => {
    console.log('Gamepad connected:', e.gamepad.id);
    gamepadRef.current.connected = true;
    gamepadRef.current.index = e.gamepad.index;
  };
  
  const handleGamepadDisconnected = (e: GamepadEvent) => {
    console.log('Gamepad disconnected');
    gamepadRef.current.connected = false;
    gamepadRef.current.index = -1;
  };
  
  window.addEventListener('gamepadconnected', handleGamepadConnected);
  window.addEventListener('gamepaddisconnected', handleGamepadDisconnected);
  
  return () => {
    window.removeEventListener('gamepadconnected', handleGamepadConnected);
    window.removeEventListener('gamepaddisconnected', handleGamepadDisconnected);
  };
}, []);
```

#### 1.3 Create Gamepad Polling Function
```typescript
const pollGamepad = () => {
  if (!gamepadRef.current.connected) return;
  
  const gamepads = navigator.getGamepads();
  const gamepad = gamepads[gamepadRef.current.index];
  
  if (!gamepad) {
    gamepadRef.current.connected = false;
    return;
  }
  
  // Apply deadzones and process inputs
  const STICK_DEADZONE = 0.15;
  const TRIGGER_DEADZONE = 0.05;
  
  // Steering (Left Stick X-Axis)
  const stickX = gamepad.axes[0];
  if (Math.abs(stickX) > STICK_DEADZONE) {
    if (stickX < 0) {
      inputsRef.current.left = true;
      inputsRef.current.right = false;
    } else {
      inputsRef.current.right = true;
      inputsRef.current.left = false;
    }
  } else {
    // Don't override keyboard input if gamepad is neutral
    // Only clear if no keyboard input
    if (!isKeyboardActive()) {
      inputsRef.current.left = false;
      inputsRef.current.right = false;
    }
  }
  
  // Acceleration (Right Trigger)
  const rightTrigger = gamepad.buttons[7]?.value || 0;
  if (rightTrigger > TRIGGER_DEADZONE) {
    inputsRef.current.up = true;
  } else {
    if (!isKeyboardActive()) {
      inputsRef.current.up = false;
    }
  }
  
  // Braking (Left Trigger)
  const leftTrigger = gamepad.buttons[6]?.value || 0;
  if (leftTrigger > TRIGGER_DEADZONE) {
    inputsRef.current.down = true;
  } else {
    if (!isKeyboardActive()) {
      inputsRef.current.down = false;
    }
  }
  
  // Handbrake (A Button or RB/LB)
  const aButton = gamepad.buttons[0]?.pressed || false;
  const rbButton = gamepad.buttons[5]?.pressed || false;
  if (aButton || rbButton) {
    inputsRef.current.space = true;
  } else {
    if (!isKeyboardActive()) {
      inputsRef.current.space = false;
    }
  }
  
  // D-pad fallback controls
  if (gamepad.buttons[12]?.pressed) inputsRef.current.up = true;
  if (gamepad.buttons[13]?.pressed) inputsRef.current.down = true;
  if (gamepad.buttons[14]?.pressed) inputsRef.current.left = true;
  if (gamepad.buttons[15]?.pressed) inputsRef.current.right = true;
};
```

#### 1.4 Integrate Polling into Game Loop
Add `pollGamepad()` call at the start of the main game loop, before physics update.

### Phase 2: Enhanced Input System

#### 2.1 Keyboard Activity Tracking
To allow seamless switching between keyboard and gamepad without conflicts:

```typescript
const keyboardActivityRef = useRef({
  lastKeyTime: 0,
  timeout: 500 // Consider keyboard inactive after 500ms
});

const isKeyboardActive = () => {
  return Date.now() - keyboardActivityRef.current.lastKeyTime < keyboardActivityRef.current.timeout;
};

// Update in keyboard handlers:
const handleKeyDown = (e: KeyboardEvent) => {
  keyboardActivityRef.current.lastKeyTime = Date.now();
  // ... existing code
};
```

#### 2.2 Analog Input Support (Advanced)
For true analog control (beyond digital on/off):

**Option A: Extend Input State**
```typescript
inputsRef.current = {
  up: false,
  down: false,
  left: false,
  right: false,
  space: false,
  // NEW: Analog values
  upAnalog: 0.0,      // 0.0 - 1.0
  downAnalog: 0.0,    // 0.0 - 1.0
  steeringAnalog: 0.0 // -1.0 to 1.0
};
```

**Option B: Keep Digital, Use Smoothing**
Apply interpolation to steering angle when gamepad is active for smoother control.

### Phase 3: UI/UX Enhancements

#### 3.1 Connection Status Indicator
Add visual feedback when gamepad is connected/disconnected:
- Toast notification on connection
- Small gamepad icon in HUD when active
- Control scheme display (keyboard vs gamepad)

#### 3.2 Updated Controls Display
Modify the bottom-right control display to show gamepad controls when active:

```
GAMEPAD CONTROLS
LT : BRAKE/REVERSE
RT : ACCELERATE
LEFT STICK : STEER
A / RB : HANDBRAKE
START : MENU
```

#### 3.3 In-Menu Support
Add gamepad navigation in menu screen:
- D-pad / Left Stick: Navigate track selection
- A Button: Select track
- B Button: Back/Cancel
- Start: Custom action

### Phase 4: Configuration & Tuning

#### 4.1 Add to Tuning Config (types.ts)
```typescript
export interface TuningConfig {
  // ... existing fields
  
  // NEW: Gamepad Settings
  gamepadEnabled?: boolean;
  gamepadSteeringSensitivity?: number; // 0.5 - 2.0
  gamepadSteeringDeadzone?: number;    // 0.0 - 0.3
  gamepadTriggerDeadzone?: number;     // 0.0 - 0.2
  gamepadVibration?: boolean;          // Future: force feedback
}
```

#### 4.2 Default Values
```typescript
gamepadEnabled: true,
gamepadSteeringSensitivity: 1.0,
gamepadSteeringDeadzone: 0.15,
gamepadTriggerDeadzone: 0.05,
gamepadVibration: false
```

#### 4.3 Debug Menu Integration
Add gamepad settings section to DebugMenu.tsx for testing and configuration.

### Phase 5: Advanced Features (Optional)

#### 5.1 Force Feedback / Vibration
Use Gamepad Haptic Actuators API:
- Light rumble on drift
- Heavy rumble on collision/offroad
- Variable intensity based on speed

```typescript
if (gamepad.vibrationActuator) {
  gamepad.vibrationActuator.playEffect('dual-rumble', {
    startDelay: 0,
    duration: 200,
    weakMagnitude: 0.5,
    strongMagnitude: 0.8
  });
}
```

#### 5.2 Button Remapping
Allow users to customize button layout through debug menu or settings file.

#### 5.3 Multiple Gamepad Support
For potential multiplayer or spectator features.

## Testing Plan

### Browser Compatibility
- **Chrome/Edge**: Full support (Chromium)
- **Firefox**: Full support
- **Safari**: Limited support (check compatibility)

### Controller Testing
1. **Connection/Disconnection**: Plug/unplug during gameplay
2. **Input Response**: All buttons and axes respond correctly
3. **Deadzone Tuning**: No drift at neutral position
4. **Analog Smoothness**: Steering feels natural
5. **Simultaneous Input**: Keyboard + gamepad don't conflict
6. **Menu Navigation**: Can navigate menus with gamepad

### Edge Cases
- Multiple controllers connected (use first detected)
- Controller disconnects mid-race (show warning, pause, or continue with keyboard)
- No gamepad support in browser (graceful degradation)
- Invalid/unknown controller layout (standard mapping fallback)

## File Modifications Summary

### Modified Files
1. **components/GameEngine.tsx** (Major)
   - Add gamepad state refs
   - Add connection event handlers
   - Implement gamepad polling function
   - Integrate polling into game loop
   - Update control display based on active input method

2. **types.ts** (Minor)
   - Add gamepad configuration fields to TuningConfig interface

3. **components/DebugMenu.tsx** (Optional)
   - Add gamepad settings section for testing

4. **App.tsx** (Minor, if menu navigation added)
   - Add gamepad navigation in menu mode

### New Files
- **Rally-Legends-Gamepad-Update.md** (This document)

## Implementation Checklist

- [ ] **Phase 1**: Core gamepad infrastructure
  - [ ] Add gamepad state management
  - [ ] Implement connection detection
  - [ ] Create polling function
  - [ ] Integrate into game loop
  - [ ] Test basic functionality

- [ ] **Phase 2**: Enhanced input system
  - [ ] Add keyboard activity tracking
  - [ ] Prevent input conflicts
  - [ ] Test seamless switching
  - [ ] (Optional) Add analog input support

- [ ] **Phase 3**: UI/UX enhancements
  - [ ] Add connection status indicator
  - [ ] Update control display for gamepad
  - [ ] Add menu navigation support
  - [ ] Test user experience

- [ ] **Phase 4**: Configuration & tuning
  - [ ] Add gamepad settings to types
  - [ ] Set default values
  - [ ] Add debug menu controls
  - [ ] Test configuration changes

- [ ] **Phase 5**: Advanced features (Optional)
  - [ ] Implement force feedback
  - [ ] Add button remapping
  - [ ] Support multiple gamepads
  - [ ] Final polish and testing

## Estimated Implementation Time

- **Phase 1 (Core)**: 2-3 hours
- **Phase 2 (Enhanced)**: 1-2 hours
- **Phase 3 (UI/UX)**: 1-2 hours
- **Phase 4 (Config)**: 1 hour
- **Phase 5 (Advanced)**: 2-4 hours (optional)

**Total**: 5-8 hours for core implementation, 7-12 hours with optional features

## Notes & Considerations

### Browser Support
The Gamepad API has excellent support across modern browsers. No polyfills required for Chrome, Firefox, Edge, and modern Safari.

### Performance Impact
Gamepad polling is lightweight and should have negligible performance impact. The `navigator.getGamepads()` call returns a snapshot and doesn't trigger browser events.

### Backwards Compatibility
All keyboard controls remain fully functional. Gamepad support is purely additive and doesn't break existing gameplay.

### User Preference
The system auto-detects the most recently used input method. Users can seamlessly switch between keyboard and gamepad mid-race without any configuration.

### Future Enhancements
- Custom button mapping UI
- Gamepad sensitivity curves (linear, exponential, S-curve)
- Per-car gamepad profiles
- Multiplayer with multiple gamepad support
- Steering wheel peripheral support (using same Gamepad API)

## References

- [MDN Web Docs - Gamepad API](https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API)
- [W3C Gamepad Specification](https://www.w3.org/TR/gamepad/)
- [Standard Gamepad Mapping](https://w3c.github.io/gamepad/#remapping)
- [Browser Compatibility Table](https://caniuse.com/gamepad)

---

**Document Version**: 1.0  
**Created**: December 13, 2025  
**Last Updated**: December 13, 2025  
**Status**: Planning Complete - Ready for Implementation
