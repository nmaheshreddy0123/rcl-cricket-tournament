# RCL 2027 Firestore Security Specification

## 1. Data Invariants
1. **Sequential Slot Ordering**: A team document at `/teams/slot-{N}` (`1 <= N <= 24`) cannot be created unless `registrationMeta/sequence.nextSlot == N` (or `N == 1` when `sequence` does not yet exist) and `registrationMeta/sequence` is atomically updated to `N + 1` in the same batch/transaction.
2. **Atomic Uniqueness Reservations**: Every `/teams/{teamId}` creation must atomically create `/teamNames/{teamNameKey}`, `/teamBrands/{brandNameKey}`, and `/teamRegistrations/{teamId}` referencing `teamId`.
3. **Identity & Ownership Integrity**: Every `/teamRegistrations/{teamId}` creation must set `ownerUid == request.auth.uid`.
4. **PII Isolation**: `captainPhone` is stored exclusively in `/teamRegistrations/{teamId}` and is never exposed in `/teams/{teamId}` or readable by non-owners/non-admins.
5. **Temporal Integrity**: `registeredAt` on `/teams/{teamId}` must equal `request.time`.
6. **Admin-Only Updates & Immutable Slot Keys**: Once registered, regular users (including the original registrant) cannot edit or delete any team slot, name/brand reservation, or private registration record. Only a verified admin (`nmaheshreddy0123@gmail.com`) can update an existing team slot or its private registration record. `slot`, `registeredAt`, `teamId`, and `ownerUid` remain immutable, `updatedAt` must equal `request.time`, and renaming a team/brand must atomically swap its uniqueness reservation. Existing registrations cannot be deleted by clients.
7. **Payment Status Integrity**: Newly registered teams must initialize `paymentStatus` to `"pending"`. Non-admin users cannot elevate `paymentStatus` to `"paid"`; only a verified admin (`nmaheshreddy0123@gmail.com`) may update `paymentStatus` between `"pending"` and `"paid"`.

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
12. **Post-Registration User Edit / Deletion**: Even the registering user (`ownerUid == request.auth.uid`) or any other non-admin attempts to `update` or `delete` `/teams/slot-1`, `/teamRegistrations/slot-1`, `/teamNames/*`, or `/teamBrands/*`.
