import pathlib 
p=pathlib.Path('src/utils/docxParser.js') 
lines=p.read_text(encoding='utf-8').splitlines() 
start=max(0,len(lines)-140) 
[print(f'{i+1}: {lines[i]}') for i in range(start,len(lines))] 
