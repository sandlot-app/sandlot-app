#!/usr/bin/env bash
# Regenerates the test clips: four scoring phrases read by macOS's Samantha voice, each as a clean clip and a noisy one
# (five voices of crowd babble plus pink noise). Needs a Mac (`say`) and ffmpeg. The output is 16-bit mono PCM at 24 kHz,
# the only audio voice-session takes, with 0.4 s of quiet before the words and 0.3 s after, like a real press.
#
#   apps/mobile/scripts/voice-loop/make-clips.sh [output folder]
#
# The default folder is outside the repo. Keep it that way: audio stays out of git unless Christian says otherwise.
set -euo pipefail

out="${1:-$HOME/Downloads/sandlot-voice-clips}"
mkdir -p "$out"
cd "$out"

say -v Samantha -o soto-hits-ruiz.aiff "Soto hits Ruiz, Ruiz takes first."
say -v Samantha -o nguyen-walks.aiff "Nguyen walks."
say -v Samantha -o ball.aiff "Ball."
say -v Samantha -o darcy-singles.aiff "Darcy singles, Soto to third."

i=0
for voice in Daniel Karen Moira Fred Tessa; do
  i=$((i + 1))
  say -v "$voice" -o "babble$i.aiff" "Come on blue, that was outside. Lets go Hawks, good eye good eye, swing batter batter, nice catch, throw it to first, what a play, you got this kid, run run run"
done
ffmpeg -loglevel error -y -i babble1.aiff -i babble2.aiff -i babble3.aiff -i babble4.aiff -i babble5.aiff \
  -filter_complex "amix=inputs=5:duration=longest,volume=2.5,aloop=loop=3:size=2e6" -ar 24000 -ac 1 babble.wav
ffmpeg -loglevel error -y -f lavfi -i "anoisesrc=color=pink:amplitude=0.08:sample_rate=24000:duration=12" -ac 1 pink.wav

for clip in soto-hits-ruiz nguyen-walks ball darcy-singles; do
  ffmpeg -loglevel error -y -i "$clip.aiff" -af "adelay=400|400,apad=pad_dur=0.3" -ar 24000 -ac 1 -f s16le "$clip.clean.pcm"
  ffmpeg -loglevel error -y -i "$clip.aiff" -i babble.wav -i pink.wav \
    -filter_complex "[0]adelay=400|400,apad=pad_dur=0.3,aresample=24000[v];[1]volume=0.55[b];[2]volume=0.9[p];[v][b][p]amix=inputs=3:duration=first:normalize=0" \
    -ar 24000 -ac 1 -f s16le "$clip.noisy.pcm"
done

echo "Clips are in $out"
