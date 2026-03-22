# Exam Importer

This directory contains the DOCX-to-raw-Azota import pipeline, parser logic,
normalization steps, validation helpers, and single-file debug scripts used by
the admin review flow.

Key entry points:

- `run_single_import.py`: run the Python pipeline for one `.docx` file
- `export_import_result.py`: bridge script used by the web server import flow
- `app/import_pipeline/`: parser, normalizer, validator, extractor

This file exists so tools that expect a workspace README can read it without
raising `ENOENT`.
