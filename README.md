# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Exam Resources Schema

For long-term maintenance, every `exam.json` should store external/internal exam assets in a single canonical block:

```json
{
  "resources": {
    "exam_file_url": null,
    "answer_file_url": null,
    "answer_file_name": null,
    "video_url": null,
    "edit_link": null
  }
}
```

Rules:

- Put all exam assets under `resources`, do not scatter fields like `video_url` or `edit_link` at the root for new data.
- Use `snake_case` keys only.
- Use full `https://...` URLs for external resources.
- Use relative file names such as `de-goc.pdf` or `dap-an.pdf` for files stored inside the exam folder.
- Keep `index.json` lean; exam resources should primarily live in each `exam.json`.

Current canonical meanings:

- `resources.exam_file_url`: file/link of the original exam
- `resources.answer_file_url`: answer file or official solutions
- `resources.answer_file_name`: preferred download file name for the answer file
- `resources.video_url`: video explanation for VIP users
- `resources.edit_link`: internal editing/review link for admins or collaborators
