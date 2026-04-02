import pathlib 
p=pathlib.Path('scripts/convert_exam_with_llm.py') 
lines=p.read_text(encoding='utf-8').splitlines() 
[print(f'{i+1}: {lines[i]}') for i in range(2360,2460)] 
