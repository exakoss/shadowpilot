# ShadowPilot Runway Pitch Video Prompt Pack

Goal: make a simple 50-60 second founder pitch for ShadowPilot. Use Runway Generate Speech for the narration, then use Runway for short visual clips and stitch everything together in a timeline editor.

## Best Workflow

Runway works best as a short-clip generator, not as a one-shot 60-second pitch generator. Make four 15-second clips if your current model allows 15 seconds, or six 10-second clips if you are using Gen-4/Gen-4 Turbo. Put the clips in order, add generated narration across the whole timeline, then add clean text overlays manually in the editor.

Standard plan should be enough for a simple finished minute, especially if you use Gen-4 Turbo for visuals. It does not guarantee a perfect result in one try; save credits for at least one regeneration of the weakest clip.

Use these project assets as references where useful:

- `/Users/dan/Desktop/ShadowPilot-public/apps/web/public/brand-exports/shadowpilot-mark-1024-black.jpg`
- `/Users/dan/Desktop/ShadowPilot-public/apps/web/public/brand-exports/shadowpilot-logo-1200x320-black.jpg`
- Optional: screen recordings from `/buyer`, `/pilot`, and the local simulator

Avoid asking Runway to generate readable UI text. Let Runway make the cinematic motion, then add all important text manually in the editor.

## Audio Plan

Use Runway `Generate Audio` -> `Generate Speech`.

Voice direction: calm young male founder, clear American English, conversational, confident but not salesy, medium-low pitch, natural startup-demo pacing, slight Miami/US startup energy, no announcer voice.

Paste the voiceover script below. Preview a few preset voices before generating. Pick the voice that sounds least theatrical and most like a real founder on a demo call. Export/download the generated speech, then place it across the full 50-60 second timeline.

Do not use a cloned custom voice while sick unless you already have clean old voice samples. A generic preset voice is better than training a bad voice clone from hoarse audio.

If `Generate Speech` is not visible in Runway, use ElevenLabs or local Kokoro instead:

- Fastest: ElevenLabs free tier. Generate the narration as a voiceover, download the audio, then import it into the final video editor.
- Fully local: Kokoro TTS through Kokoro-FastAPI or HeadTTS. This is free and private, but setup takes longer and the voice may need more tuning.
- Do not use SFX or Stylize Audio for this pitch. Those tools are for sound effects or transforming existing audio, not creating narration from a script.

## Voiceover Script

Hi, I'm Boobavelli, solo founder of ShadowPilot. We're building a private ops network for physical AI.

Robotics labs, manufacturers, and research teams can post teleoperation or humanoid data-capture tasks with SOL bounties. When a robot hits an edge case, or a lab needs human demonstrations, verified pilots can claim the task, operate remotely, submit the trace, get paid, and build reputation.

The protocol uses Solana for escrow, payouts, and training-rights receipts, World ID for real-human-only work, and Arcium for private scoring and reputation. Raw video and operator details stay protected while buyers still get confidence in data quality.

I'm the right founder because I've spent four-plus years building crypto-consumer products and ten years as a hardware and robotics hobbyist. ShadowPilot combines both worlds: consumer distribution, onchain incentives, and the human data layer robotics needs next.

## Four 15-Second Runway Clip Prompts

### Clip 1: Founder + Problem

Use the uploaded ShadowPilot logo image as brand reference. Create a grounded documentary-style startup pitch opener. A solo founder works at a laptop in a modest Miami apartment workspace at night, with a robotics dashboard and code editor visible but not readable. Cut to close-up hands connecting a small robot controller and a laptop showing a dark operations console. Natural handheld camera, warm practical light, focused and sincere, not flashy. No readable text, no fake logos, no distorted screens.

Manual overlay: `ShadowPilot` and `Private robotics ops network`

### Clip 2: What ShadowPilot Builds

Create a realistic physical AI operations montage. A robotics lab posts a remote operation task, a global pilot accepts it from a laptop, and a robot arm or warehouse rover resumes a task after human takeover. Visualize the flow as cinematic b-roll: funded task, claim, teleoperation, submission. Keep screens abstract and unreadable. Modern hardware lab, warehouse rover aisle, robotic arm drawing a line on a whiteboard, Solana bounty represented by subtle coin/token motion, professional documentary lighting. No readable text.

Manual overlay: `Buyers post SOL bounties. Pilots complete robot tasks.`

### Clip 3: Privacy + Trust Layer

Create a polished but restrained visualization of private verification for robot operations. Show a pilot profile represented by a protected identity vault, a human verification check, encrypted task artifacts, and an onchain settlement receipt. The style should be grounded enterprise documentary with subtle technical overlays, not sci-fi fantasy. Visual motifs: World ID human proof, Arcium private scoring, Solana escrow and provenance, encrypted video trace, reputation update. No readable text, no brand-name text generated by the model.

Manual overlay: `World ID: real humans` / `Arcium: private reputation` / `Solana: escrow + receipts`

### Clip 4: Why Now + Why Me

Create an optimistic closing montage for a solo founder building the distribution layer for physical AI. Show robotics labs, manufacturing floors, remote pilots around the world, and a founder testing a small robotic arm setup. The mood is clear, confident, and practical. End on the uploaded ShadowPilot mark as a clean final frame, black background, white robotic arm mark, premium but simple. No fake UI text, no unreadable subtitles, no extra logos.

Manual overlay: `The missing human layer for physical AI`

## Recommended Six-Clip Visual Direction

Use the Earth robot-factory direction. It feels more credible for a hackathon pitch than a space factory: real robotics labs, manufacturing floors, data centers, pilots, and onchain settlement. Keep it grounded, cinematic, and documentary-like. Use the same visual language across every clip: black, white, graphite, small Solana-green accents, soft lab lighting, realistic hardware, subtle data motion.

Current timing plan: Clip 1 is trimmed to about 12-13 seconds, Clips 2-4 are 10 seconds each, Clip 5 is 5 seconds, and Clip 6 can be 10 seconds trimmed to fit the final narration. Expected total: about 55-58 seconds before adding a final logo card.

Current production status:

- Clip 1: completed; trim before the fake wall text appears.
- Clip 2: completed; acceptable as the warehouse edge-case insert.
- Clip 3: completed; keep as the human buyer/operator task-posting shot.
- Clip 4: remaining; generate as the remote pilot teleoperation shot.
- Clip 5: completed; keep as the 5-second private trust-layer / server-room shot.
- Clip 6: remaining; generate as the settlement + humanoid data-capture + logo-close shot.

Global negative prompt for every clip: no readable generated text, no fake brand logos, no distorted hands, no talking avatars, no cartoon sci-fi, no neon cyberpunk city, no hologram overload, no cluttered UI, no extra robot limbs, no subtitles baked into the video.

### Clip 1: The Robot Factory Wakes Up

Duration: 15 seconds. Aspect ratio: 16:9.

Prompt: A grounded cinematic opening inside a real robotics manufacturing floor on Earth. Humanoid robot frames, robotic arms, small rovers, calibration rigs, engineers moving in the background, and a wall of quiet data servers connected to the floor. The camera slowly pushes forward from the factory entrance toward a robotic arm preparing for a task. Subtle black-and-white ShadowPilot brand feeling with small green data accents. Documentary lighting, realistic robotics hardware, premium startup pitch b-roll, shallow depth of field, no readable text.

Manual overlay: `ShadowPilot`

### Clip 2: The Autonomy Gap

Duration: 10 seconds. Aspect ratio: 16:9.

Prompt: A warehouse rover or robotic arm encounters an edge case during operation. The robot pauses at a blocked aisle or misaligned whiteboard station while compact telemetry particles and data packets move from the robot to a nearby server rack. The mood is not disaster, just a real operational handoff moment. Camera alternates between robot sensors, wheels or joints, and a quiet control room screen with abstract unreadable UI. Realistic, restrained, physical AI operations, no readable text.

Manual overlay: `Robots still need human fallback`

### Clip 3: Buyer Posts A Bounty

Duration: 10 seconds. Aspect ratio: 16:9.

Prompt: A human robotics lab operator inside the same dark Earth-based robot factory and data-center environment from the opening clip creates a task from a clean operations console. The person is visible from behind or in profile, wearing simple lab/factory workwear, looking through glass at humanoid robot frames, robotic arms, and server racks. Represent the task abstractly with a funded mission card, a SOL bounty icon, and encrypted task bundle flowing from the operator console into a global task network. Show human decision-making, factory context, data servers, and subtle onchain escrow particles. Professional enterprise documentary style, grounded crypto infrastructure. No close-up faces, no distorted hands, no wall signage, no generated logos, no readable text anywhere; leave screens and labels blank or abstract.

Manual overlay: `Buyers post SOL bounties`

### Clip 4: Pilot Claims And Operates

Duration: 10 seconds. Aspect ratio: 16:9.

Prompt: A verified remote pilot at a simple home workstation claims a robotics task and starts teleoperation. Show the pilot from behind or in profile, using a controller and laptop with abstract unreadable controls. Intercut with the same dark Earth-based robot factory and data-center environment: a warehouse rover or robotic arm resumes movement after human takeover. Show the connection as clean data streams between pilot, server racks, and robot. Human-centered, practical, confident, global workforce feeling, realistic hands and controllers, no close-up faces. No wall signage, no generated logos, no readable text anywhere; leave screens and labels blank or abstract.

Manual overlay: `Verified pilots complete the work`

### Clip 5: Private Trust Layer

Duration: 5 seconds. Aspect ratio: 16:9.

Prompt: A restrained visualization of privacy-preserving trust infrastructure. Encrypted pilot reputation, human verification, private scoring, and onchain escrow are shown as physical data vaults inside a server room connected to the robot factory. Use abstract icons only: shield, human check, encrypted lock, receipt token, score pulse. The raw video trace stays private while compact metrics move through protected rails. Premium, minimal, grounded, no readable text, no sci-fi hologram overload.

Manual overlay: `World ID + Arcium + Solana`

### Clip 6: Settlement And Data Flywheel

Duration: 10 seconds. Aspect ratio: 16:9. Trim if needed in the editor.

Prompt: Closing cinematic montage showing ShadowPilot as a marketplace for both robot teleoperation and humanoid data collection. Show a completed robot recovery, a remote pilot receiving payout, a buyer receiving a digital training-rights receipt, and humanoid demonstration data flowing into a robotics training pipeline. Include a brief shot of a humanoid robot mirror-learning from human motion capture or demonstration footage, with anonymized data moving through server racks. Dark Earth-based robotics factory and data-center environment, black graphite surfaces, subtle green data accents, realistic robots and servers, optimistic but serious startup pitch ending. Leave the final wall or center area clean and empty for a real logo overlay added later. No generated logos, no readable text, no wall signage, no fake brand marks, no distorted hands, no close-up faces.

Manual overlay: `The human ops layer for physical AI`

## Six 10-Second Variant

If your Runway model only supports 5 or 10 seconds, use this structure:

1. Founder workspace and quick intro.
2. Robot gets stuck; buyer posts a task.
3. Pilot claims and teleoperates.
4. Submission, review, payout.
5. World ID, Arcium, and Solana trust layer.
6. Founder / robotics lab closing with ShadowPilot logo.

## Editing Checklist

1. Generate the narration first, aiming for 55-60 seconds.
2. Generate clips in 16:9, preferably 720p or 1080p.
3. Download the clips and assemble them in Runway Video Editor, CapCut, iMovie, DaVinci Resolve, or any timeline editor.
4. Put the generated narration over the full sequence.
5. Add only a few manual captions. Keep them large, high contrast, and readable.
6. Use light music under the voiceover only if it does not compete with speech.
7. Export as a single MP4 under 2 minutes.

## Recommended Standard Plan Credit Strategy

Use Gen-4 Turbo, 16:9, 10 seconds per generation, 720p. Six clips cost about 300 credits before any audio or edits. That leaves room from the Standard monthly allowance for generated speech and one or more retries.

If one visual clip looks bad, do not regenerate the whole video. Replace only that clip.

## Shorter Backup Script

Hi, I'm Boobavelli, solo founder of ShadowPilot. We're building a private operations network for physical AI: robotics teams post teleoperation or humanoid data-capture tasks with SOL bounties, and verified pilots complete the work, get paid, and build reputation.

The timing matters because robots are moving into the real world, but the human distribution layer is missing. ShadowPilot combines Solana escrow and receipts, World ID human verification, and Arcium private scoring so buyers can trust the data without exposing pilots.

The demo already has buyer and pilot consoles, task claims, video submission, review, settlement, and training-rights receipts. I'm full-time on this from Miami, with a full-stack crypto-consumer background and recent hackathon wins. ShadowPilot turns human skill into the missing ops and data layer for physical AI.
