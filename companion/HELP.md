# Variable Viewer Module Help

This module allows you to send data from Bitfocus Companion to the "Companion Variable Viewer" application, which can then display these variables on a customizable webpage.

## Setup and Usage

1.  **Run the Variable Viewer Application:**
    *   Start the "Companion Variable Viewer" application on your computer (or another computer on your network).
    *   Note the IP address of the computer running the application and the port it's using (default is 3333). You can find network IP addresses displayed in the designer UI of the application.

2.  **Install and Configure This Module in Companion:**
    *   Add the "Variable Viewer" module to your Bitfocus Companion configuration.
    *   In the module settings:
        *   Set **Target IP** to the IP address of the machine running the Variable Viewer application.
        *   Set **Target Port** to the port the Variable Viewer application is listening on (e.g., 3333).

3.  **Understanding Module Variables:**
    *   This module provides 10 pre-defined variables: `text_1`, `text_2`, ..., `text_10`.
    *   These are the variables that will be sent to the Viewer application.

4.  **Sending Data to the Viewer Application:**
    *   To update these variables and send them to the viewer, use the **"Set Text Variable"** action provided by this module.
    *   Create a button or trigger in Companion.
    *   Add the "Set Text Variable" action.
        *   **Variable:** Choose one of the 10 variables (e.g., `text_1`).
        *   **Value:** Enter the text or Companion variable you want to display. For example:
            *   Static text: `Hello World`
            *   Companion variable: `$(internal:custom_my_var)` or `$(atem:program_input_longname)`
    *   When this action is triggered in Companion:
        1.  The module updates its internal state for the selected `text_X` variable.
        2.  The module updates the corresponding variable in Companion's global variable list.
        3.  The module sends all 10 of its `text_X` variables (including the updated one) to the connected Variable Viewer application.

5.  **Designing the Layout:**
    *   Open the Companion Variable Viewer application. It should open to the **Designer** page (e.g., `http://<your_app_ip>:3333/designer`).
    *   If no layout has been loaded, you should see default placeholders for `text_1` through `text_10`. If you've already sent data from Companion, these placeholders might show the current values.
    *   Drag these placeholders onto the canvas, resize them (by adjusting font size in the controls), change their color, edit their display titles, and set the canvas background.
    *   Click the "Save Layout" button in the designer to save your arrangement.

6.  **Viewing the Variables:**
    *   Open the **Viewer** page. You can do this via:
        *   The "File" > "Open Viewer Window" menu in the Electron application.
        *   The URLs displayed in the "Viewer URLs" section of the Designer sidebar (copy and paste into a browser on any device on the same network).
    *   The viewer page will display the variables as configured in your layout, updating in real-time as they change in Companion (via the "Set Text Variable" action).

By following these steps, you can effectively use Companion variables to display dynamic information on a custom-styled webpage. 