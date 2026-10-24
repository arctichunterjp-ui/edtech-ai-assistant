#!/usr/bin/env python3
"""Builds data/vocab.js from the N5 PDF (text layer) and data/n4.tsv (word<TAB>reading<TAB>meaning).
Usage: python3 scripts/build_vocab.py path/to/jlpt-n5-vocabulary.pdf"""
import re, json, subprocess, sys, csv

PHRASES = {"ありがとうございます": "thank you (polite)", "ちょっと待ってください": "please wait a moment",
           "ごちそうさまでした": "thank you for the meal", "いってらっしゃい": "have a good day",
           "おはようございます": "good morning", "よろしくお願いします": "please take care of me"}

def parse_n5(pdf):
    txt = subprocess.run(["pdftotext", "-layout", pdf, "-"], capture_output=True, text=True).stdout
    out = []
    for line in txt.splitlines():
        m = re.match(r"^\s*(\d+)\s{2,}(.*\S)\s*$", line)
        if not m: continue
        cols = re.split(r"\s{2,}", m.group(2).strip())
        pos = cols[-1] if re.fullmatch(r"[a-z\-\.]+", cols[-1]) else ""
        if len(cols) == 5:    kanji, reading, eng = cols[0], cols[1], cols[3]
        elif len(cols) == 4:  kanji, reading, eng = cols[0], cols[0], cols[2]   # kana/katakana-only rows
        else:
            k = next((k for k in PHRASES if m.group(2).startswith(k)), None)
            if not k: print("SKIP", line); continue
            kanji = reading = k; eng = PHRASES[k]; pos = "phras"
        out.append({"lv": "N5", "w": kanji, "r": reading, "m": eng, "p": pos.rstrip(".")})
    return out

def parse_n4(path):
    out = []
    for row in csv.reader(open(path, encoding="utf-8"), delimiter="\t"):
        if len(row) >= 3 and not row[0].startswith("#"):
            w, r, m = (c.strip() for c in row[:3])
            out.append({"lv": "N4", "w": w or r, "r": r, "m": m, "p": ""})
    return out

def clean(e):
    e["m"] = re.sub(r"^--\s*|\s*--$", "", e["m"]).strip()
    e["s"] = e["m"].split(";")[0].strip()[:40] or e["m"][:40]   # short meaning for MCQ options
    return e

if __name__ == "__main__":
    items = parse_n5(sys.argv[1]) + parse_n4("data/n4.tsv")
    seen, final = set(), []
    for e in map(clean, items):
        k = (e["w"], e["r"])
        if k in seen: continue
        seen.add(k); final.append(e)
    open("data/vocab.js", "w", encoding="utf-8").write("window.VOCAB = " + json.dumps(final, ensure_ascii=False, separators=(",", ":")) + ";\n")
    print(len(final), "words:", sum(e["lv"] == "N5" for e in final), "N5 /", sum(e["lv"] == "N4" for e in final), "N4")
