import subprocess
from typing import List, Tuple

def _merge_ranges(ranges: List[Tuple[int,int]]):
    ranges = sorted((s,e) for s,e in ranges if e > s)
    if not ranges: return []
    merged = [list(ranges[0])]
    for s,e in ranges[1:]:
        if s <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], e)
        else:
            merged.append([s,e])
    return [(s,e) for s,e in merged]

def invert_deletes(total_frames: int, deletes: List[Tuple[int,int]]):
    dels = _merge_ranges(deletes)
    keeps = []
    prev = 0
    for s,e in dels:
        if prev < s:
            keeps.append((prev, s))
        prev = e
    if prev < total_frames:
        keeps.append((prev, total_frames))
    return keeps

def build_concat_filter(keeps_sec):
    parts = []
    vlabels = []
    alabels = []
    for i,(ts,te) in enumerate(keeps_sec):
        parts.append(f"[0:v]trim=start={ts}:end={te},setpts=PTS-STARTPTS[v{i}]")
        parts.append(f"[0:a]atrim=start={ts}:end={te},asetpts=PTS-STARTPTS[a{i}]")
        vlabels.append(f"[v{i}]")
        alabels.append(f"[a{i}]")
    vcat = "".join(vlabels)
    acat = "".join(alabels)
    parts.append(f"{vcat}{acat}concat=n={len(keeps_sec)}:v=1:a=1[outv][outa]")
    return ";".join(parts)

def export_with_ffmpeg(input_path: str, output_path: str, deletes_frames, fps: float, total_frames: int):
    keeps = invert_deletes(total_frames, deletes_frames)
    if not keeps:
        raise RuntimeError("All frames deleted: nothing to export.")
    keeps_sec = [(round(s/fps, 6), round(e/fps, 6)) for s,e in keeps]
    filter_complex = build_concat_filter(keeps_sec)
    cmd = [
        "ffmpeg", "-y", "-i", input_path,
        "-filter_complex", filter_complex,
        "-map", "[outv]", "-map", "[outa]",
        "-c:v", "libx264", "-preset", "medium", "-crf", "20",
        "-c:a", "aac", "-b:a", "192k",
        output_path
    ]
    subprocess.run(cmd, check=True)
    return output_path
