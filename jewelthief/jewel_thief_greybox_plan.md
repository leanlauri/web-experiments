# Jewel Thief Player Character — Greybox Production Plan

**Project:** Rooftop jewel thief freerunning game  
**Character:** Vex Vale, also known as *The Facet Fox*  
**Asset type:** Low-poly stylised 3D player character  
**Gameplay format:** 3D environment with 2D side-on movement  
**Plan version:** 0.1  

---

## 1. Current Goal

Create the first playable greybox version of the jewel thief character.

This version does **not** need final textures, facial detail, polished animation, or cloth physics. Its purpose is to prove that the character reads well from a side camera and supports the core movement set: running, jumping, vaulting, flipping, landing, tripping, and falling.

The first milestone should answer three questions:

1. Does the silhouette look like a stylish rooftop thief?
2. Do the proportions support clear, agile parkour animations?
3. Does the character remain readable during fast movement in a 2D gameplay plane?

---

## 2. Character Summary

### Name

**Vex Vale**

### Alias

**The Facet Fox**

### Role

Playable jewel thief and freerunner.

### Personality

Vex should feel quick, clever, theatrical, and confident. The character should not feel gritty or realistic. The tone should be stylish, playful, and adventurous.

### Visual Identity

A low-poly parkour thief with a pointed hood, dark outfit, jewel-coloured accents, scarf or sash, side satchel, gloves, and chunky soft-soled shoes.

### Gameplay Identity

The character turns rooftop escapes into a performance. Movement should feel light, precise, and slightly showy.

---

## 3. Design Lock for Greybox

For the first model, lock the following features:

| Feature | Decision |
|---|---|
| Body type | Slim, athletic, slightly exaggerated |
| Head | Slightly oversized stylised head |
| Hood | Pointed hood with fox-like silhouette |
| Face | Simple mask or dark face area with visible eyes |
| Torso | Cropped jacket over fitted undersuit |
| Accessory | Diagonal strap and hip satchel |
| Trail element | Long scarf or sash trailing behind |
| Feet | Chunky parkour shoes |
| Hands | Simplified gloved hands |
| Colour logic | Dark clothing with bright jewel accents |
| Camera priority | Must read clearly from side view |

Do not add too many tiny pouches, straps, buckles, or jewellery pieces yet. Those can come later if the silhouette remains clean.

---

## 4. Side-View Silhouette Requirements

The player will mostly read the character from a side-on camera, so the silhouette matters more than small surface detail.

The character should be identifiable from the following shapes:

- Pointed hood
- Slightly oversized head
- Compact torso
- Long agile legs
- Chunky shoes
- Side satchel
- Trailing scarf or sash
- Strong forward lean while running

The satchel should sit on the camera-facing side during the default view so players can see it. If the character flips direction by rotating 180 degrees, use a mirrored setup or allow the satchel to remain readable from both directions.

---

## 5. Greybox Model Specification

### Target Complexity

| Item | Target |
|---|---|
| Triangle count | 2,000–4,000 tris for first version |
| Materials | 3–5 flat-colour materials |
| Texture detail | None required for greybox |
| Rig | Simple humanoid rig plus accessory bones |
| Face rig | Not required |
| Cloth simulation | Not required |
| Scarf movement | Bone-animated placeholder |
| Animation style | Snappy, readable, exaggerated |

### Recommended Scale

Use a human-like but stylised scale.

| Part | Approximate Proportion |
|---|---|
| Total height | 1.0 character unit or 1.7–1.8 metres, depending on engine scale |
| Head | Larger than realistic; about 1/5 of total body height |
| Torso | Compact and angular |
| Arms | Slightly long for vaulting readability |
| Legs | Slightly long for agile running poses |
| Feet | Oversized enough to show contact with rooftops |

---

## 6. Body Blockout

Build the first model using simple low-poly primitives.

### Mesh Parts

| Mesh Part | Shape Guide | Notes |
|---|---|---|
| Head | Low-poly sphere or beveled cube | Slightly oversized |
| Hood | Cone/cowl shape around head | Pointed rear or small ear-like tips |
| Mask/face | Flat dark face panel | Keep simple |
| Torso | Tapered cube | Wider shoulders, narrow waist |
| Jacket | Separate shell over torso | Cropped and angular |
| Pelvis | Small block | Hidden by belt area |
| Upper arms | Low-poly cylinders | Clean deformation loops |
| Forearms | Low-poly cylinders | Slightly tapered |
| Hands | Simple mitten shapes | Gloves, no detailed fingers yet |
| Upper legs | Low-poly cylinders | Athletic but slim |
| Lower legs | Low-poly cylinders | Taper toward ankle |
| Feet | Wedge-like blocks | Chunky soft parkour shoes |
| Belt | Thin torus/cube strip | Keep visible from side |
| Satchel | Small rounded cube at hip | Attach to pelvis/strap |
| Strap | Thin diagonal strip | Across chest |
| Scarf/sash | Segmented strip | 4–6 segments for rigging |
| Jewel clasp | Small diamond shape | Chest or belt accent |

### Mesh Naming Convention

Use clear names from the beginning:

```text
CH_Vex_Body
CH_Vex_Head
CH_Vex_Hood
CH_Vex_Mask
CH_Vex_Jacket
CH_Vex_Gloves
CH_Vex_Shoes
CH_Vex_Belt
CH_Vex_Satchel
CH_Vex_Strap
CH_Vex_Scarf
CH_Vex_GemClasp
```

---

## 7. Temporary Greybox Colour Palette

Use flat materials. Avoid pure black because the character will disappear against dark city backgrounds.

| Material Name | Colour Use |
|---|---|
| MAT_Dark_Navy | Hood, jacket, main outfit |
| MAT_Charcoal | Gloves, mask, shoe details |
| MAT_Deep_Purple | Trousers, secondary clothing |
| MAT_Teal_Accent | Scarf or sash |
| MAT_Gold_Accent | Belt clasp, small trim |
| MAT_Gem_Cyan | Jewel clasp and collectible response points |

During greybox, material contrast is more important than final beauty. Test the character against dark rooftops, moonlit skies, warm windows, and bright jewel pickups.

---

## 8. Rig Plan

### Core Humanoid Bones

Minimum required rig:

```text
Root
Pelvis
Spine_01
Spine_02
Chest
Neck
Head
UpperArm_L
LowerArm_L
Hand_L
UpperArm_R
LowerArm_R
Hand_R
UpperLeg_L
LowerLeg_L
Foot_L
Toe_L
UpperLeg_R
LowerLeg_R
Foot_R
Toe_R
```

### Accessory Bones

Recommended extra bones:

```text
Scarf_01
Scarf_02
Scarf_03
Scarf_04
Satchel
Hood_Tip
CoatTail_L
CoatTail_R
```

### Rigging Notes

- Place the root at ground level between the feet.
- Keep the pelvis separate from the root so the body can squash, crouch, and land without moving the whole controller.
- Add enough geometry around shoulders, elbows, hips, knees, and ankles for clean deformation.
- Keep scarf bones simple. The scarf should support broad motion, not detailed cloth behaviour.
- Use in-place animation for the first gameplay prototype unless the engine controller is already designed around root motion.

---

## 9. Animation Milestone 1

The first playable animation set should be small. Do not animate the full final list yet.

### Required First-Pass Animations

| Animation | Length Target | Priority | Notes |
|---|---:|---:|---|
| Idle | 60–90 frames | High | Slight breathing, alert posture |
| Run | 18–24 frames loop | Critical | Most important animation in the game |
| Jump_Start | 6–10 frames | Critical | Quick anticipation, knees bend |
| Jump_Rise | 12–20 frames hold/loop | Critical | Arms and knees readable from side |
| Fall | 12–20 frames loop | Critical | Scarf trails upward slightly |
| Land_Light | 8–12 frames | Critical | Compress then return to run/idle |
| Vault_Low | 18–28 frames | High | Hands touch obstacle, legs swing over |
| Trip | 20–30 frames | High | Comedic stumble, not too harsh |
| Roll_Landing | 18–28 frames | Medium | Used after bigger drops |

### Animation Priorities

The **run cycle** is the key animation. Spend the most time on it.

A good run should include:

- Forward lean
- Clear foot contacts
- Springy leg compression
- Strong arm swing
- Scarf trailing backward
- Satchel bouncing slightly
- Head remaining readable

---

## 10. Animation Milestone 2

Add these once the first set feels good in-engine.

| Animation | Use |
|---|---|
| Sprint | Faster version of run |
| Stop_Skid | Sudden stop or direction change |
| Turnaround | Flip movement direction |
| Slide | Move under low obstacle |
| Front_Flip | Trick jump |
| Backflip | Stylish reverse trick |
| Wall_Jump | Push away from wall |
| Edge_Grab | Catch ledge after near miss |
| Climb_Up | Pull onto rooftop |
| Window_Dive | Pass through window opening |

---

## 11. Animation State Machine Draft

```text
Idle
 ├── Run
 │    ├── Sprint
 │    ├── Stop_Skid
 │    ├── Vault_Low
 │    ├── Slide
 │    ├── Trip
 │    └── Jump_Start
 │          ├── Jump_Rise
 │          ├── Trick_Flip
 │          ├── Fall
 │          ├── Land_Light
 │          └── Roll_Landing
 ├── Edge_Grab
 │    ├── Climb_Up
 │    └── Drop
 └── Fall
      └── Recover
```

### Transition Rules

- The gameplay controller should drive movement speed, not the animation itself.
- Use animation events for important moments such as footstep contact, vault hand contact, landing impact, and trip recovery.
- Let jump and fall animations be interruptible where responsiveness matters.
- Tricks should not trap the player in long animations unless the game intentionally rewards committed trick timing.

---

## 12. Blender Build Steps

### Step 1 — Scene Setup

- Set units to metric or the target engine unit scale.
- Place the character origin at ground level between the feet.
- Add a side-view camera to check readability.
- Add a simple platform block beside the character for scale.

### Step 2 — Body Blockout

- Build the head, torso, pelvis, arms, legs, hands, and feet with primitives.
- Use low segment counts, such as 6–8 sides for cylinders.
- Keep forms angular and clean.
- Check the side silhouette before adding accessories.

### Step 3 — Outfit Blockout

Add the following separate objects:

1. Hood
2. Jacket shell
3. Belt
4. Chest strap
5. Satchel
6. Gloves
7. Shoes
8. Scarf or sash
9. Jewel clasp

### Step 4 — Side-View Test

From the side camera, confirm that the character is recognisable without colour or texture.

The silhouette should show:

- Hood
- Satchel
- Scarf/sash
- Chunky shoes
- Agile posture

### Step 5 — Temporary Materials

Apply flat colours using the greybox palette. Test visibility against a dark rooftop background.

### Step 6 — Rig Blockout

Create the humanoid armature and accessory bones. Bind the mesh with automatic weights, then manually clean the shoulders, hips, knees, and scarf.

### Step 7 — First Animation Pass

Animate only:

1. Idle
2. Run
3. Jump_Start
4. Jump_Rise
5. Fall
6. Land_Light
7. Vault_Low
8. Trip
9. Roll_Landing

### Step 8 — Engine Import Test

Import the character into the target engine and test:

- Scale
- Side camera readability
- Run speed match
- Jump timing
- Landing timing
- Vault obstacle alignment
- Direction flip or rotation
- Animation transitions

---

## 13. Engine Export Settings

### Recommended Export Format

Use **FBX** for Unity or Unreal animation pipelines. Use **glTF/GLB** for lightweight preview, web, or custom tooling.

### Export Guidelines

| Setting | Recommendation |
|---|---|
| Apply transforms | Yes |
| Origin | Ground level between feet |
| Forward direction | Consistent with engine convention |
| Animation type | In-place for prototype |
| Clip names | Clear action names |
| Scale | Match engine character controller |
| Materials | Flat colours only for first pass |
| Armature | Single humanoid armature |

### Suggested Clip Names

```text
Vex_Idle
Vex_Run
Vex_Jump_Start
Vex_Jump_Rise
Vex_Fall
Vex_Land_Light
Vex_Vault_Low
Vex_Trip
Vex_Roll_Landing
```

---

## 14. Gameplay Alignment Notes

Because this is a 3D world with 2D movement, the character should be controlled on a fixed gameplay plane.

Recommended approach:

- Let the controller move the character physically.
- Use in-place animations for most actions.
- Rotate or mirror the character when changing direction.
- Keep vault, window, and ledge interactions aligned to simple gameplay markers.
- Use animation events to sync hands and feet with obstacle contact points.

For vaults and windows, create invisible helper markers in levels:

```text
Vault_Start
Vault_Contact
Vault_Clear
Vault_End
Window_Entry
Window_Center
Window_Exit
Ledge_Grab_Point
Ledge_Stand_Point
```

These markers will make animation alignment much easier.

---

## 15. First Greybox Deliverables

The next production milestone should produce:

| Deliverable | Description |
|---|---|
| Character mesh | Low-poly thief body with hood, scarf, satchel, shoes, and strap |
| Temporary materials | Flat greybox colours with jewel accents |
| Humanoid rig | Basic playable rig with accessory bones |
| Animation set | Idle, run, jump, fall, land, vault, trip, roll |
| Engine import | Character visible and playable in test scene |
| Test obstacle | One low vault obstacle and one rooftop gap |
| Review notes | Issues with scale, silhouette, timing, and readability |

---

## 16. Review Checklist

Use this checklist before moving to final art.

### Silhouette

- [ ] The hood reads clearly from the side.
- [ ] The scarf/sash is visible during movement.
- [ ] The satchel does not clutter the body shape.
- [ ] The shoes clearly show foot contact.
- [ ] The character looks agile, not heavy.

### Animation

- [ ] Run cycle feels fast and springy.
- [ ] Jump takeoff is responsive.
- [ ] Fall pose is readable.
- [ ] Landing does not feel delayed.
- [ ] Vault lines up with obstacle height.
- [ ] Trip is clear but not too long.
- [ ] Roll landing transitions cleanly back to running.

### Gameplay

- [ ] Movement remains responsive during animation transitions.
- [ ] The character stays aligned to the 2D movement plane.
- [ ] Direction changes look clean.
- [ ] The model does not clip badly through common obstacles.
- [ ] The character remains visible against dark rooftops.

### Technical

- [ ] Mesh names are clean.
- [ ] Bone names are clean.
- [ ] Origin is correct.
- [ ] Scale is correct in-engine.
- [ ] Animation clips are named correctly.
- [ ] No unnecessary materials or loose objects are exported.

---

## 17. Art Brief for a 3D Artist

Create a low-poly stylised 3D parkour jewel thief for a side-scrolling rooftop platformer. The character should be slim, agile, and playful, with a pointed hood, small mask or dark face panel, cropped jacket, diagonal strap, hip satchel, chunky parkour shoes, gloves, and a long scarf or sash. The character should use dark navy, purple, charcoal, and jewel-coloured accents such as teal, cyan, ruby, emerald, or gold. The silhouette must be readable from a side camera and the character must support fast acrobatic animation, including running, jumping, vaulting, flipping, tripping, falling, and landing.

The first version should be a greybox model with flat colours and a simple humanoid rig. Prioritise clean movement, readability, and strong silhouette over final detail.

---

## 18. Immediate Next Tasks

### Task 1 — Build the Static Greybox

Create the blockout mesh with the required silhouette features:

- Body
- Hood
- Mask/face panel
- Jacket
- Strap
- Satchel
- Scarf/sash
- Gloves
- Shoes
- Jewel clasp

### Task 2 — Check Side Camera Readability

Test the character as a flat side-on silhouette. Shrink the view to approximate gameplay size and confirm the design still reads.

### Task 3 — Add Temporary Materials

Apply dark outfit colours and bright accent materials. Test against a basic city rooftop background.

### Task 4 — Create Basic Rig

Rig the body and add simple accessory bones for scarf, satchel, and hood tip.

### Task 5 — Animate the Run Cycle

Animate the run before anything else. If the run does not feel right, revise proportions before continuing.

### Task 6 — Add Jump and Landing

Create the jump start, rise, fall, and light landing animations. Test them in-engine with the movement controller.

---

## 19. Notes for Future Character Expansion

Once Vex works, other characters can be designed around different silhouettes and movement personalities.

Possible future characters:

| Character Type | Gameplay/Visual Role |
|---|---|
| Rival thief | Faster, sharper, more angular silhouette |
| Rooftop guard | Heavier, blockier, slower movement |
| Drone operator | Tech-focused antagonist |
| Acrobat mentor | Graceful trick-focused character |
| Gem collector NPC | Quest or shop character |
| City inspector | Comedic obstacle character |

Each character should have a distinct silhouette so the player can recognise them instantly during fast movement.

---

## 20. Milestone Definition of Done

The greybox milestone is complete when:

- Vex has a readable low-poly silhouette from a side camera.
- The model includes hood, scarf/sash, satchel, strap, gloves, and chunky shoes.
- The character has a basic humanoid rig.
- The first animation set works in-engine.
- Run, jump, fall, land, vault, trip, and roll are testable.
- The player controller remains responsive.
- The character looks stylish and thief-like even without final textures.

Only after this milestone should final modelling, polished textures, detailed accessories, extra tricks, and cinematic animation be added.
