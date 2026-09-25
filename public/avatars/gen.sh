#!/bin/bash
cd /home/z/my-project/public/avatars
declare -a PROMPTS=(
"Professional headshot portrait of an Indian woman in her 40s, astrologer, warm gentle smile, wearing an elegant deep maroon saree, neutral warm beige studio background, soft natural lighting, photorealistic, high quality"
"Professional headshot portrait of an Indian man in his 50s, astrologer scholar, grey-streaked hair, calm confident expression, wearing a formal shirt, neutral warm beige studio background, soft lighting, photorealistic, high quality"
"Professional headshot portrait of a senior Indian man in his 60s, experienced astrologer, white beard, kind eyes, wearing a simple cream kurta, neutral warm studio background, soft lighting, photorealistic, high quality"
"Professional headshot portrait of an Indian woman in her early 30s, modern astrologer, friendly smile, neat hair, wearing a subtle mustard salwar kameez, neutral warm beige background, soft studio lighting, photorealistic, high quality"
"Professional headshot portrait of an Indian man in his late 30s, academic astrologer, glasses, warm smile, wearing a navy blazer over a light shirt, neutral warm background, soft lighting, photorealistic, high quality"
"Professional headshot portrait of an Indian woman in her 50s, Vedic astrologer, serene expression, grey-streaked hair in a bun, wearing a teal silk saree, neutral warm studio background, soft lighting, photorealistic, high quality"
"Professional headshot portrait of an Indian man in his 40s, astrologer, short dark hair, warm confident smile, wearing a formal grey shirt, neutral warm beige background, soft studio lighting, photorealistic, high quality"
"Professional headshot portrait of a young Indian woman in her late 20s, astrology content creator, bright genuine smile, wearing a coral kurti, neutral warm background, soft lighting, photorealistic, high quality"
"Professional headshot portrait of a senior Indian woman in her 60s, traditional astrologer grandmotherly figure, gentle smile, wearing a simple brown cotton saree, neutral warm studio background, soft lighting, photorealistic, high quality"
"Professional headshot portrait of an Indian man in his early 30s, tech-savvy astrologer, friendly smile, neat beard, wearing a casual charcoal shirt, neutral warm background, soft studio lighting, photorealistic, high quality"
"Professional headshot portrait of an Indian man in his 50s, scholarly astrologer, receding grey hair, thoughtful expression, wearing a sand-brown Nehru jacket, neutral warm background, soft lighting, photorealistic, high quality"
"Professional headshot portrait of an Indian woman in her 40s, professional astrologer and counsellor, calm smile, shoulder-length hair, wearing an off-white kurta with a subtle dupatta, neutral warm background, soft lighting, photorealistic, high quality"
)
for i in "${!PROMPTS[@]}"; do
  n=$(printf "%02d" $((i+1)))
  z-ai image -p "${PROMPTS[$i]}" -o "./ast-$n.png" -s 1024x1024 2>>gen.log && echo "ok ast-$n" >> gen.log || echo "FAIL ast-$n" >> gen.log &
  # limit concurrency to 3
  while [ "$(jobs -r | wc -l)" -ge 3 ]; do sleep 1; done
done
wait
echo "ALL_DONE" >> gen.log
