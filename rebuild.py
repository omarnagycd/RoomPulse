from pathlib import Path
import json
p=Path(__file__).parent;q=(p/'node_modules/qrcode-generator/dist/qrcode.js').read_text();q=q[:q.rfind('(function (factory)')];(p/'worker.js').write_text(q+'\nconst HTML='+json.dumps((p/'index.html').read_text(),ensure_ascii=False)+';\n'+(p/'backend.js').read_text())
