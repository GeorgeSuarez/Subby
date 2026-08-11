/**
 * Edit modal route — same form as `/subscription/add`, but presented as a
 * regular `card` over the detail sheet.
 *
 * The detail screen (`[id]`) is presented as a `formSheet`; pushing ANOTHER
 * `formSheet` screen on top of it in the same native stack renders a blank
 * black sheet on iOS (react-native-screens limitation). A `card` push slides
 * in within the already-presented sheet, so the edit form renders correctly
 * and back/cancel returns to the detail screen.
 */

export { default } from './add';
