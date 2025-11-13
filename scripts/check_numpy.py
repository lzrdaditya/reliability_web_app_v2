import os, sys
print('CWD:', os.getcwd())
print('PYTHON:', sys.executable)
print('sys.path[0]:', sys.path[0])
print('sys.path entries with "numpy":')
for p in sys.path:
    if 'numpy' in p.lower():
        print(' -', p)

print('\nDirectory listing:')
for name in sorted(os.listdir('.')):
    print(' -', name)

# Check for local files named 'numpy'
local_matches = [n for n in os.listdir('.') if 'numpy' in n.lower()]
print('\nLocal names containing numpy:', local_matches)
