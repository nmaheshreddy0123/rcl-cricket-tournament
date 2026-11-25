# RCL 2027 Firestore Security Specification

## 1. Data Invariants
1. **Sequential Slot Ordering**: A team document at `/teams/slot-{N}` (`1 <= N <= 24`) cannot be created unless `registrationMeta/sequence.nextSlot == N` (or `N == 1` when `sequence` does not yet exist) and `registrationMeta/sequence` is atomically updated to `N + 1` in the same batch/transaction.
2. **Atomic Uniqueness Reservations**: Every `/teams/{teamId}` creation must atomically create `/teamNames/{teamNameKey}` and `/teamRegistrations/{teamId}` referencing `teamId`.
3. **Identity & Ownership Integrity**: Every `/teamRegistrations/{teamId}` creation must set `ownerUid == request.auth.uid`.
4. **Registration Ownership Isolation**: `ownerUid` and private registration ownership metadata remain isolated in `/teamRegistrations/{teamId}` (readable only by the owning registrant or admin). New team registrations require a non-empty `brandName` (Team Title, without 3-char or uniqueness validation) and a 10-digit `captainPhone` (also stored on `/teams/{teamId}` for display on team cards).
5. **Temporal Integrity**: `registeredAt` on `/teams/{teamId}` must equal `request.time`.
6. **Admin-Only Updates & Immutable Slot Keys**: Once registered, regular users (including the original registrant) cannot edit or delete team details, name reservations, or private registration records. Only a verified admin (`nmaheshreddy0123@gmail.com`) can update team details or private registration records. `slot`, `registeredAt`, `teamId`, and `ownerUid` remain immutable, `updatedAt` must equal `request.time`, and renaming a team must atomically swap its `/teamNames/{teamNameKey}` uniqueness reservation. Existing registrations cannot be deleted by clients.
7. **Payment Screenshot Submission**: Newly registered teams initialize `paymentStatus` to `"pending"`. Any signed-in user may submit a JPG, PNG, or WebP payment screenshot (stored via Firebase Storage URL or a compact compressed Data URL up to 65536 bytes) on a pending slot to mark `paymentStatus` as `"paid"`. Once marked `"paid"`, the slot is locked for non-admins; only organisers can revert or modify it. Private `teamRegistrations` PII remains strictly restricted to the owning registrant or admin.

## 2. Dirty Dozen Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Unauthenticated Team Create**: Anonymous/unauthenticated client (`auth == null`) writes to `/teams/slot-1`.
2. **Shadow Field Injection**: Signed-in user writes `/teams/slot-1` with extra field `isVerified: true` or `role: "admin"`.
3. **Slot Skipping (State Shortcutting)**: Signed-in user writes `/teams/slot-5` when `registrationMeta/sequence.nextSlot` is `1` or `2`.
4. **Orphaned Team Without Sequence Update**: Signed-in user creates `/teams/slot-1` without updating `/registrationMeta/sequence` in the same transaction.
5. **Orphaned Team Without Name/Brand Reservation**: Signed-in user creates `/teams/slot-1` without creating `/teamNames/{teamNameKey}` or `/teamBrands/{brandNameKey}`.
6. **Identity Spoofing on Registration**: Signed-in user (`uid: "userA"`) creates `/teamRegistrations/slot-1` with `ownerUid: "userB"`.
7. **PII Blanket Read / Cross-User Phone Scrape**: Signed-in user `"userB"` attempts `get` or `list` on `/teamRegistrations/slot-1` owned by `"userA"`.
8. **Timestamp Forgery**: Signed-in user creates `/teams/slot-1` with client-supplied `registeredAt` not equal to `request.time`.
9. **Resource Poisoning via Oversized ID**: Signed-in user creates `/teamNames/<200-char-id>` or `/teams/invalid-id!@#`.
10. **Value Poisoning via Oversized String**: Signed-in user creates `/teams/slot-1` with `teamName` length > 60 or `logoUrl` length > 65536.
11. **Sequence Tampering**: Signed-in user updates `/registrationMeta/sequence` directly without creating the corresponding `/teams/slot-{N}` document, or jumps `nextSlot` by +5.
12. **Post-Registration User Edit / Deletion**: Even the registering user (`ownerUid == request.auth.uid`) or any other non-admin attempts to change team details, edit or delete `/teamRegistrations/slot-1`, or edit/delete `/teamNames/*` or `/teamBrands/*`. The narrowly scoped payment submission update is allowed only on a `"pending"` slot to transition it once to `"paid"` with `paymentScreenshotUrl` and `updatedAt`.
