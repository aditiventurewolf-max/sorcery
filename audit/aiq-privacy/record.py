#!/usr/bin/env python3
"""Append one audit result to results.jsonl. Usage: record.py '<json>'"""
import json, sys, os
rec = json.loads(sys.argv[1])
required = {'college','verdict'}
assert required <= set(rec), f"missing {required - set(rec)}"
assert rec['verdict'] in ('FAIL','PASS','PROVISIONAL'), rec['verdict']
with open(os.path.join(os.path.dirname(__file__),'results.jsonl'),'a') as f:
    f.write(json.dumps(rec)+'\n')
print("recorded:", rec['college'], '->', rec['verdict'])
