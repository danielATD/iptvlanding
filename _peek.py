import json
d = json.load(open('catalog_data/_series_test.json', 'r', encoding='utf-16'))
print('KEYS:', list(d.keys()))
if 'seasons' in d:
    print('SEASONS:', list(d['seasons'].keys()) if isinstance(d['seasons'], dict) else d['seasons'])
if 'episodes' in d:
    eps = d['episodes']
    if isinstance(eps, dict):
        print('EPISODES KEYS:', list(eps.keys()))
        for s, ep_list in eps.items():
            print(f'  Season {s}: {len(ep_list)} episodes')
