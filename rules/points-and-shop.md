# Points, Streak, Shop, Pet, and Medals (Interface)

Students must see an honest picture of their points, streak, medals, purchases, and the classroom pet, and must be able to request purchases and equips, while the server remains the only owner of balances, prices, streaks, and item state.

## Authority and scope

- [Master §2.7](../master-document.md#27-puntos-tienda-racha-mascota-y-minijuegos) defines the single currency, the shop, classroom items, the streak, the pet, mini-games, and medals; [§6.2](../master-document.md#62-canales-y-propiedad-de-los-datos) assigns points, shop, and streak to NestJS/PostgreSQL.
- [Master §2.10](../master-document.md#210-objetos-y-elementos-interactuables) lists the shop, report card, pet, and game console as illustrative interactable objects; [§9.2](../master-document.md#92-mvp-extendido-en-orden-de-prioridad) places mini-games, the pet with accessories, and medals in the extended MVP, while the shop with at least one functional classroom item belongs to the core.
- The backend rule *Points, streak, and shop* owns the ledger, prices, the streak computation, ownership, and anti-abuse. Grades produce points; see [Activities and grading](./activities-and-grading.md).
- [Security](./security.md) and [Quality and testing](./quality-and-testing.md) supply the common validation and evidence requirements.
- These rules define observable behavior, not a price list, item catalog, medal catalog, or streak formula.

## Ownership

| Owner | Responsibility |
|---|---|
| NestJS / PostgreSQL | Points ledger, balances, prices, streak, shop catalog, classroom items, pet accessories, medals |
| Colyseus | Deliver the live effect of classroom items (for example games disabled) after the backend confirms them |
| Frontend | Render balance, streak, medals, the shop, and the pet; request purchases and equips; represent pending, rejected, and uncertain outcomes |

- The client **MUST NOT** set or compute a balance, a price, a streak, an item state, or an accessory ownership. It displays what the server returns.
- A visible shop object, an open panel, or a cached catalog **MUST NOT** grant the right to buy.
- The points balance is per student (individual, decided); the interface **MUST NOT** show a classroom-wide or shared balance.
- Parents see only the points of linked children; a student **MUST NOT** see another student's exact balance unless a decision says otherwise (open).

## Points, streak, and medals display

- Points, streak, and medals **MUST** be visible to the student in the 3D world (for example through the report card) and in the 2D mode, from the same server data.
- The balance **MUST** come from the server. After a grade or purchase, the interface **MUST** show the confirmed balance; a pending change **MUST** be marked as pending and **MUST NOT** be presented as already applied.
- The interface **SHOULD** explain where points came from (for example a graded activity or a purchase) using the reason returned by the server; it **MUST NOT** invent the reason.
- The streak breaks when the requirement (a real activity in the period) is not met (decided); the server computes it and the interface **MUST** show the streak as the server reports it, never extending or restoring it locally. The interface **MUST NOT** present a bare login as extending the streak or promise a reward the product has not decided on.
- The day boundary of the streak follows server time and the agreed zone ([Data and time](./data-and-time.md)); the client clock **MUST NOT** decide it.
- Medals **MUST** be displayed from the server's award records; the interface **MUST NOT** award or simulate them. The medal catalog and conditions are open.
- A balance that cannot be retrieved **MUST** be shown as unavailable, not as zero.

## Shop

- The shop **MUST** list items with the price and availability returned by the server, split into classroom items (games, upgrades) and pet accessories. It is reachable from the shop object in the 3D world and from the 2D mode.
- The interface **MUST NOT** send a price; a purchase request names the item and relies on server-side price, authorization, and balance checks.
- A purchase **MUST** show pending, confirmed, rejected (for example insufficient balance or unavailable item), and uncertain outcomes, update the balance only from the confirmed result, and be guarded against accidental duplicate submission.
- A timeout **MUST NOT** be treated as proof that the purchase failed; reconcile with the server before offering the purchase again, so a retry does not charge twice.
- Only items that map to real functionality are purchasable; the interface **MUST NOT** offer an item the server marks as not purchasable.
- Classroom items are bought by students (decided), paying from their own individual balance; the interface **MUST NOT** offer purchase to teachers or parents. Refunds and whether items are consumable or permanent are open decisions. The interface **MUST NOT** assume them.
- Teachers and administrators may see the classroom's items according to their role; manual point adjustments, if they exist, are an open backend decision and **MUST NOT** appear until decided.
- Points cannot be transferred between students; the interface **MUST NOT** offer transfers.

## Classroom items and mini-games

- Classroom items purchased through the shop appear and work according to server state; a purchased item **MUST** show its real effect, not a cosmetic placeholder.
- Mini-games (for example Tetris, Pong) are classroom items offered through an object such as a game console. They cannot be played during class: the teacher disables them at will.
- When mini-games are disabled, the interface **MUST** show the disabled state clearly (for example a console that cannot be used, with an explanation) and **MUST NOT** start a game session. The disabled state is persisted by the backend, announced live, and holds across reload and reconnect; a client that connects later **MUST** receive the current state from the server.
- The disabled state **MUST NOT** be enforced only by hiding a control; a game request that reaches the server while disabled is rejected and the interface **MUST** present that.
- Teacher-level users see the control to disable or enable mini-games ([Live classroom tools](./live-classroom-tools.md)); students do not.
- Game logic running in the client **MUST NOT** be a source of rewards. Whether scores or rewards exist, and whether games are disabled by default during scheduled class time, are open decisions.
- Mini-games **MUST** remain usable in 2D mode if offered, and keyboard-accessible; if a game cannot be made accessible it is not an essential function.

## Classroom pet

- Each classroom has one pet. It is a **motivational element only**: it has no conversational role and is shown as a decorated companion.
- The pet **MUST NOT** be linked to, rendered as, or interacted with as the AI bot. The bot is a separate in-world tutor character ([AI bot and daily briefing](./ai-bot-and-daily-briefing.md)); the two **MUST** have distinct objects, visuals, and entry points, and **MUST NOT** share state, panels, or copy.
- The pet is shown in the classroom scene with the accessories the server says it owns and has equipped. The interface **MUST NOT** show an accessory as equipped before the server confirms it, and **MUST NOT** equip an unowned accessory.
- Accessories are bought with points through the shop. Who may buy and equip accessories is an open decision.
- Pet state (accessories) is persisted by the backend and rendered by the client; its animation is local and is not persisted. A pet asset that fails to load **MUST** fall back to an honest placeholder without losing the confirmed accessory data ([3D world and camera](./3d-world-and-camera.md)).
- The pet and its accessories belong to the extended MVP; they **MUST NOT** block core flows.
- The 2D mode **SHOULD** offer a way to see the pet and its accessories; this is not an essential function.

## Input, errors, and recovery

- Shop, equip, and request controls **MUST** follow [Forms and validation](./forms-and-validation.md) and [Error handling and feedback](./error-handling-and-feedback.md) for pending, rejected, and uncertain states.
- Rate-limit rejections from the server **MUST** be presented as understandable feedback, not as silent failure.
- Logout, account switch, or lost classroom access **MUST** clear or isolate balance, purchases, and item state of the previous context; a late response **MUST NOT** restore them.

## Normal, failure, and boundary scenarios

| Scenario | Required observable result |
|---|---|
| Student's activity is graded | The confirmed balance increases after reconciliation, with the source shown |
| Student buys an item with enough points | Pending, then confirmed, and the balance is the server's value |
| Student buys with insufficient points | The server rejection is shown; the balance does not change |
| Purchase times out | The outcome is unresolved until reconciled; no double charge is attempted by the client |
| Student only logs in | The streak does not change; a real activity is needed |
| Teacher disables mini-games | Connected students see the console disabled; a reload keeps it disabled |
| Student tries to play while disabled | The server rejects the session and the interface explains it |
| Student equips an owned accessory | The pet shows it after server confirmation |
| Student tries to equip an unowned accessory | The request is rejected; the pet is unchanged |
| Parent opens the child's points | Only the linked child's data is shown |
| Pet asset fails to load | Placeholder is shown; confirmed accessories are not lost |

## Correct and incorrect examples

**Correct:** The shop sends only the item identifier; the balance shown after the purchase is the confirmed value from the server.

**Incorrect:** The client subtracts the price from a local balance and shows the purchase as done before the server replies.

**Correct:** The pet appears next to the class with the accessories it owns; the bot has its own tutor character elsewhere.

**Incorrect:** The pet opens the bot conversation, or the bot character is presented as the classroom pet.

## Observable acceptance checks

These checks guide implementation evidence under [Quality and testing](./quality-and-testing.md); this document does not certify a running feature.

- [ ] Balance, streak, and medals shown always match server data in both 3D and 2D modes.
- [ ] A purchase shows pending, confirmed, rejected, and uncertain outcomes distinctly; a retry does not duplicate the charge.
- [ ] The client never sends a price or sets a balance, and an unpurchasable item is not offered.
- [ ] A bare login does not extend the displayed streak; a real activity does after server confirmation.
- [ ] Mini-games stay disabled across reload and reconnect when the teacher disabled them, and the interface presents server rejections.
- [ ] The pet and accessory state comes from the server; the pet is never presented or used as the AI bot.
- [ ] Logout and account switch isolate points, shop, and pet state of the previous context.
- [ ] Parents see only linked children's points; students do not see classmates' exact balances.
- [ ] [Art direction](./art-direction.md) remains the sole visual target for the shop, pet, and console objects.

## Open decisions — not implementation defaults

- Refunds and whether classroom items are consumable or permanent.
- Exact streak period and qualifying actions, streak rewards, and additional earning sources.
- Medal catalog and conditions.
- Default state and rewards of mini-games.
- Visibility of other students' balances.
- Who may buy and equip pet accessories.
- Cross-repository contract distribution remains unresolved; examples are not published API contracts.
