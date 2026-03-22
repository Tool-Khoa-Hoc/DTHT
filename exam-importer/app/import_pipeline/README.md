# Import Pipeline (Public/Private Split)

Pipeline này bám theo luồng:

1. `docx -> extracted_word_data` (`extractor.py`)
2. `extracted_word_data -> chunked_input` (`chunker.py`)
3. `chunked_input -> raw_markup_chunk` (`normalizer.py`)
4. `merge raw_markup_chunk -> full_raw_markup` (`normalizer.py`)
5. `full_raw_markup -> exam_public_json + exam_private_json` (`parser.py`)
6. `validator` kiểm đủ câu/ảnh/bảng/options và rò rỉ field nhạy cảm (`validator.py`)

Module orchestration: `pipeline.py` (`run_import_pipeline`).
