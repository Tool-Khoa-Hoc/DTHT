import pathlib 
p=pathlib.Path('lib/raw_extractor.py') 
lines=p.read_text(encoding='utf-8').splitlines() 
[print(f'{i+1}: {lines[i]}') for i in range(1,130)] 
