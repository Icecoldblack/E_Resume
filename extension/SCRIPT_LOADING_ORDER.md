# Script Loading Order Documentation

## Content Scripts Loading Order

The scripts in `manifest.json` must be loaded in the following specific order to ensure proper dependency resolution:

1. **utils.js** - Core utility functions (must load first)
   - Provides: `nativeDispatchEvents()`, `performRobustClick()`, `highlightElement()`, `sleep()`, `cleanText()`, `matchesAny()`, etc.
   - Used by: All other scripts

2. **dom-analyzer.js** - DOM analysis and page detection
   - Provides: Page analysis functions, ATS platform detection
   - Depends on: utils.js
   - Used by: content.js, form-filler.js

3. **ui.js** - User interface components
   - Provides: Overlay functions (`showProcessingOverlay()`, `updateOverlay()`, `hideOverlay()`, etc.)
   - Depends on: utils.js
   - Used by: content.js

4. **form-filler.js** - Form filling logic
   - Provides: `fillTextInput()`, `fillSelectDropdown()`, `determineFieldValue()`, `findLabelForInput()`, etc.
   - Depends on: utils.js for helper functions
   - Used by: content.js, ats-adapters.js

5. **ats-adapters.js** - ATS-specific adapters
   - Provides: Platform-specific form filling logic for Greenhouse, Lever, Workday
   - Depends on: form-filler.js functions (`fillTextInput()`, `determineFieldValue()`, `findLabelForInput()`)
   - Used by: content.js

6. **content.js** - Main entry point (must load last)
   - Orchestrates all other modules
   - Depends on: All above scripts
   - Provides: Message handlers and main autofill orchestration

## Important Notes

- **DO NOT** change this order without ensuring all dependencies are properly resolved
- The order is critical because JavaScript files are loaded synchronously in the order specified
- Each script relies on functions defined in previous scripts
- Violating this order will result in "function is not defined" runtime errors
