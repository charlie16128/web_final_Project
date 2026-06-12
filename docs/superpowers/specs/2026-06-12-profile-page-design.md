# Personal Profile Page Design

## Goal

Build a personal profile experience for TeamUp Campus so signed-in users can maintain their own profile and view other users' public profiles. The feature should feel like a profile page, not only a settings form, because it will later support richer personal profile content.

## Scope

This design covers:

- A private self profile page at `/profile`.
- A public profile page for signed-in users at `/users/:id`.
- Editable fields for the owner: avatar, name, class name, and bio.
- Read-only student ID display for the owner only.
- Public display fields for other signed-in users: avatar, name, class name, and bio.
- A homepage entry point to the profile page.
- Profile links from user names when the API response includes the target user ID.

This design does not cover:

- Password changes.
- Email changes.
- Anonymous public profile viewing.
- A follower, friend, or messaging system.
- Full homepage text cleanup beyond edits needed for the new profile entry point.

## User Experience

The profile page uses the selected "top profile banner" layout:

- A wide profile header at the top.
- Avatar, name, and class name are visually prominent.
- On the owner's own page, student ID appears as read-only private information.
- Bio appears below the header.
- When the signed-in user is viewing their own profile, edit controls are available on the same page.
- When viewing another user, the same layout is used without edit controls, upload buttons, or student ID.

If a user has no avatar, the UI shows a round placeholder using the first character of the user's name when possible. If no name is available, it uses a neutral placeholder.

## Routes

Frontend pages:

- `GET /profile` serves `public/profile.html`.
- `GET /users/:id` serves the same profile page shell, loading another user's public profile by ID.

API routes:

- `GET /api/users/me`
  - Requires authentication.
  - Returns the signed-in user's full self profile.
  - Includes `student_id`.

- `PUT /api/users/me`
  - Requires authentication.
  - Updates `name`, `class_name`, and `bio`.
  - Does not allow changing `student_id`.
  - Returns the updated self profile.

- `POST /api/users/me/avatar`
  - Requires authentication.
  - Accepts one avatar image from a file input that the frontend converts to a JSON payload.
  - Request body includes the original file name, MIME type, and base64 image data.
  - Allows `jpg`, `jpeg`, `png`, and `webp`.
  - Enforces a 2 MB upload limit.
  - Stores the file under `public/uploads/avatars`.
  - Saves the public avatar path in SQLite.
  - Returns the updated self profile or the new `avatar_url`.

- `GET /api/users/:id`
  - Requires authentication.
  - Returns public profile data for another user.
  - Does not return `student_id`.

## Data Model

The existing `users` table already has:

- `name`
- `student_id`
- `class_name`
- `email`
- `skills`
- `bio`
- `created_at`

Add:

- `avatar_url TEXT`

For this feature, `skills` remains out of scope in the UI unless it is already used elsewhere. The profile page focuses on avatar, name, class name, student ID privacy, and bio.

## Avatar Storage

Avatar image files should be selected with a normal browser file input. The frontend reads the selected file, validates its size and MIME type, then sends a JSON request to the backend with base64 image data. This avoids adding a multipart upload dependency to the current Express project.

Image files should be stored in the project filesystem at:

`public/uploads/avatars`

SQLite should store only the served path, for example:

`/uploads/avatars/user-3-20260612153000.webp`

This is preferred over storing image BLOBs directly in SQLite because the web UI can render file paths directly, the database stays small, and future migration to cloud storage remains straightforward.

Implementation should make filenames unique enough to avoid collisions by including the user ID and timestamp. Old avatar files may remain on disk in the first version; cleanup is a later maintenance task and is not required for this feature.

## Frontend Components

Add:

- `public/profile.html`
- `public/javascripts/profile.js`

Reuse:

- `public/stylesheets/style.css`
- existing token storage keys: `teamup_token`, `teamup_user`
- existing toast pattern

Homepage updates:

- Add a profile link or button in the topbar user panel, displayed as valid Traditional Chinese text.
- Preserve the logout behavior.
- Render project owner names as links to `/users/:id` where the existing project data includes the owner ID.
- Render applicant names as links to `/users/:id` if the application API response includes the applicant user ID; otherwise leave them as plain text until that API is expanded.

Profile page behavior:

- Redirect unauthenticated users to `/login`.
- Detect mode from path:
  - `/profile` loads `/api/users/me` and enables editing.
  - `/users/:id` loads `/api/users/:id` and disables editing.
- Update localStorage `teamup_user` after the owner saves profile changes so the homepage topbar stays current.
- Show toast messages for success and validation errors.

## Privacy And Validation

Student ID privacy:

- Student ID is shown only on `/profile` for the signed-in owner.
- Student ID is never returned by the public profile API.
- Student ID cannot be edited from the profile page.

Validation:

- Name is required.
- Bio and class name may be empty.
- Avatar upload accepts only image MIME types for `jpg`, `jpeg`, `png`, and `webp`.
- Avatar upload fails with a clear message if larger than 2 MB.

## Error Handling

Expected states:

- Unauthenticated users are redirected to login.
- Missing users show a friendly not-found user state.
- Failed saves and uploads show toast messages.
- Upload validation errors do not clear existing profile data.

## Testing

Manual verification should cover:

- `/profile` redirects when logged out.
- `/profile` loads full self data when logged in.
- Editing name, class name, and bio updates SQLite and localStorage.
- Student ID is visible on `/profile` and cannot be changed.
- Avatar upload accepts an allowed image under 2 MB and updates the page.
- Avatar upload rejects unsupported file types and oversized files.
- `/users/:id` requires login.
- `/users/:id` shows public data only and hides student ID and edit controls.
- Homepage profile link opens `/profile`.
- Linked names from projects or applications open `/users/:id` where implemented.

## Notes

Some existing Chinese text in `public/index.html` and related JavaScript appears mojibake. The profile implementation should avoid broad unrelated rewrites, but any new or touched profile-entry text should be valid Traditional Chinese.
