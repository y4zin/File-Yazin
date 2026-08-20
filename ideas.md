# File yazin — Design Directions

## Three approaches

### Theme Name: Amethyst Control Room
**Very Brief Intro:** A high-trust utility console assembled from low-light plum surfaces, precise data marks, and a single lilac signal color. It should feel like a focused instrument rather than a generic upload page.
**Probability:** 0.04

### Theme Name: Paper Archive Studio
**Very Brief Intro:** A warm editorial workspace inspired by archival folders, indigo ink, and dense document indexes. This direction treats file handling as careful curation.
**Probability:** 0.08

### Theme Name: Violet Spectrum Field
**Very Brief Intro:** An expressive spatial interface in which soft violet gradients are organized as a layered field, with files appearing as responsive, luminous objects.
**Probability:** 0.02

## Chosen approach: Amethyst Control Room

### Design Movement
Contemporary technical minimalism with an editorial operating-console sensibility.

### Core Principles
1. Every visual device must clarify a file-management decision or state.
2. Low-contrast surfaces establish calm; sharp lilac signals reserve attention for actionable states.
3. The workspace is asymmetric and task-led, not a centered marketing layout.
4. Typography, numbers, and icons are treated as instrumentation.

### Color Philosophy
The interface uses a deep aubergine base to reduce visual glare, ink-purple panels to create depth, and an ownable electric lilac signal for task selection and progress. Pale lavender is used sparingly for readable text and only soft mauve neutrals appear in the day-gradient option; pure white is excluded.

### Layout Paradigm
An anchored left rail provides context, tool switching, and service status. The main workbench is a wide, offset field divided into an operational header, task configuration row, primary drop zone, and file queue. Supporting format intelligence sits in a narrow right-hand ledger on larger screens and folds beneath the workbench on small screens.

### Signature Elements
1. A vertical luminescent status rail that traces the active tool.
2. Fine technical hairlines and small uppercase labels that resemble an instrument panel.
3. A faceted file mark: three offset document sheets arranged like a purple mineral.

### Interaction Philosophy
Interactions give immediate, restrained feedback. Changing a task recalibrates the queue; dropping files introduces a clear success or size-warning state; settings live in a concise side sheet. Hover effects lift only the active surface, and destructive choices are visibly separated.

### Animation
Use 160–240ms transform and opacity transitions with a crisp cubic-bezier ease-out. New queue rows enter with a 40ms stagger and a short upward drift. The active-tool status rail glides between entries. No perpetual decorative animations; respect reduced-motion preferences.

### Typography System
Space Grotesk supplies the display wordmark and high-value metric numerals. IBM Plex Sans provides controlled, highly readable interface text. Headings use compact tracking and a 600–700 weight; technical labels use uppercase, 10–11px, and generous letter spacing.

### Brand Essence
File yazin is a disciplined browser-based file workbench for people who want precise control over document-heavy work without visual noise. **Precise, composed, capable.**

### Brand Voice
Headlines are decisive and task-oriented; CTAs use direct verbs; microcopy names the real constraint instead of using vague reassurance. Examples: “Choose the rule before you add the files.” and “One file is enough to define the split.” Generic filler such as “Welcome to our website” and “Get started today” is forbidden.

### Wordmark & Logo
The wordmark pairs a geometric “File” with an italicized “yazin” tail, accompanied by a text-free three-sheet mineral mark. The symbol remains bold at favicon scale and appears at a clearly visible size in the header.

### Signature Brand Color
**Signal Lilac — #A78BFA**

## Style Decisions

- Desktop layouts keep a visible left control rail, with the active operation traced by a vertical Signal Lilac indicator. Horizontal operation controls remain secondary.
- The File yazin wordmark and three-sheet mineral mark appear in the primary product header as well as the control rail.
- Signal Lilac is reserved for active navigation, primary action, progress confirmation, and key numerals; it is not used as ambient decorative glow.
