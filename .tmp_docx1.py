import pathlib 
p=pathlib.Path('src/utils/docxParser.js') 
lines=p.read_text(encoding='utf-8').splitlines() 
[print(f'{i+1}: {lines[i]}') for i in range(0,120)] 
