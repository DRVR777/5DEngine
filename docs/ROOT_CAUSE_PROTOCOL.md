# The Root-Cause Fix Protocol

## Mindset
A "fix" that re-emerges in a slightly different form in two weeks is not a fix —
it's a delay. Genius is boring discipline applied consistently, not clever
one-liners. We are paid to make problems STAY fixed.

## The five questions before ANY fix
1. **What is the actual observed behavior?** Not what someone told you. Not what
   the error message hints. What happens end-to-end with concrete inputs/outputs.
2. **What does the system promise to do here?** The contract. If undocumented,
   what does the rest of the code assume?
3. **Where exactly does observed diverge from promised?** This is the bug
   location. NOT the symptom location.
4. **Why does it diverge?** Walk the chain. "Because X" → "Why X?" → keep going
   until the answer is a design decision, an external constraint, or a true bug.
5. **What's the SMALLEST change at the divergence point that closes it?** Not
   the easiest. Not the cleverest. The smallest at the RIGHT place.

## Three reflexes to suppress

### "Just add a check"
You add `if (badCondition) return;`. Symptom hidden, fire still burning. Find
why `badCondition` happens and fix THAT.

### "Just retry"
A call fails sometimes, you retry. Often the FIRST call failed because you
called at the wrong time, in the wrong order, with bad inputs. Ask why the
first call failed before adding a second.

### "Just catch and ignore"
`try { x() } catch {}` admits you don't know what could go wrong, and ensures
the system now runs in undefined state. If you must catch: log with full
context AND document why proceeding is safe.

## Fix-quality checklist
Before calling something fixed, prove:
- [ ] Bug describable in one sentence without mentioning the fix
- [ ] Failing test or reproduction recipe that would have caught it
- [ ] Test now passes
- [ ] Searched for OTHER places same root cause could fire
- [ ] Can explain why your change couldn't have made anything else worse
- [ ] If wrong assumption: corrected assumption documented for future maintainer

## When you can't find root cause
1. Document the symptom in detail
2. Add aggressive logging at the divergence point
3. Smallest possible workaround
4. Mark `// WORKAROUND: <symptom>, root cause unknown, see <ticket>`
5. Create the ticket. Do not let it die.
A documented workaround is honest. An undocumented one is debt.

## Escalation ladder
- 2 same-pattern fixes: pattern noticed
- 3: codebase is telling you something about its structure
- 4+: stop fixing instances, fix the structure that produces them

## Speed note
Doing the protocol is slower per bug than slapping in `?.` or try/catch. It
pays back exponentially:
- Properly fixed bug fixes 0-3 other bugs you didn't know about
- Band-aid creates 1-2 future bugs you'll have to find
- Cost of a bug grows with codebase size squared
Not "going slow." Paying down compound interest.
