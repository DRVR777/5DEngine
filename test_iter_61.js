// test_iter_61.js — economy: currencies, rates, conversion, transfer, tax.
const E = require("./economy.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

const econ = E.createEconomy({ taxRate: 0.02 });

// 1. Define currencies
econ.defineCurrency("USD", { name: "Dollar", decimals: 2, worldId: "earth" });
econ.defineCurrency("MOON", { name: "Lunar Coin", decimals: 0, worldId: "moon" });
econ.defineCurrency("CRED", { name: "Credit", decimals: 2, worldId: "underwater" });
ok(econ.listCurrencies().length === 3, "3 currencies");
ok(econ.getCurrency("USD").worldId === "earth", "USD on earth");

let threw = false;
try { econ.defineCurrency("USD", {}); } catch (e) { threw = true; }
ok(threw, "duplicate currency throws");

// 2. Rates with auto-inverse
ok(econ.setRate("USD", "MOON", 0.5), "1 USD = 0.5 MOON");
ok(econ.getRate("USD", "MOON") === 0.5, "rate stored");
ok(econ.getRate("MOON", "USD") === 2, "auto-inverse 2:1");

// Same-currency rate is 1
ok(econ.getRate("USD", "USD") === 1, "self-rate = 1");
// Unknown
ok(econ.getRate("USD", "GHOST") === null, "unknown rate → null");
ok(econ.setRate("USD", "GHOST", 1) === false, "rate to unknown currency rejected");

// Bad rate
threw = false;
try { econ.setRate("USD", "MOON", 0); } catch (e) { threw = true; }
ok(threw, "rate=0 throws");

// 3. Deposit
const d1 = econ.deposit("alice", "USD", 1000);
ok(d1.ok === true, "alice deposit 1000 USD");
ok(econ.balance("alice", "USD") === 1000, "balance = 1000");
ok(econ.getCurrency("USD").supply === 1000, "USD supply tracks");

ok(econ.deposit("alice", "GHOST", 100).ok === false, "deposit unknown ccy fails");
ok(econ.deposit("alice", "USD", 0).ok === false, "0 deposit rejected");
ok(econ.deposit("alice", "USD", -5).ok === false, "negative deposit rejected");

// Multiple wallets
econ.deposit("bob", "MOON", 50);
ok(econ.balance("bob", "MOON") === 50, "bob has 50 MOON");
ok(econ.balance("bob", "USD") === 0, "bob has 0 USD");

// 4. Withdraw
const w1 = econ.withdraw("alice", "USD", 200);
ok(w1.ok === true, "withdraw 200 ok");
ok(econ.balance("alice", "USD") === 800, "balance after withdraw = 800");
ok(econ.getCurrency("USD").supply === 800, "supply decreased");

ok(econ.withdraw("alice", "USD", 10000).ok === false, "insufficient withdraw rejected");

// 5. Convert with tax
// alice has 800 USD. Convert 100 USD → MOON at 0.5 with 2% tax
// Gross: 50 MOON. Tax: 1 MOON. Net: 49 MOON.
const c1 = econ.convert("alice", "USD", "MOON", 100);
ok(c1.ok === true, "convert 100 USD → MOON ok");
ok(c1.netOut === 49, `net = 49 MOON (50 - 1 tax) (got ${c1.netOut})`);
ok(c1.tax === 1, "tax = 1 MOON");
ok(econ.balance("alice", "USD") === 700, "USD - 100 = 700");
ok(econ.balance("alice", "MOON") === 49, "MOON += 49");

// Insufficient funds
const c2 = econ.convert("alice", "USD", "MOON", 10000);
ok(c2.ok === false, "insufficient convert rejected");

// No rate
const c3 = econ.convert("alice", "USD", "CRED", 1);
ok(c3.ok === false && c3.reason === "no_rate", "no rate → fail");

// 6. transfer between players
econ.deposit("carol", "USD", 500);
const t1 = econ.transfer("carol", "dave", "USD", 100);
ok(t1.ok === true, "transfer 100 USD ok");
// 2% tax on 100 = 2; net to dave = 98
ok(t1.sentNet === 98, `dave receives 98 (got ${t1.sentNet})`);
ok(t1.tax === 2, "tax = 2");
ok(econ.balance("carol", "USD") === 400, "carol -100");
ok(econ.balance("dave", "USD") === 98, "dave +98");

// Insufficient
ok(econ.transfer("carol", "dave", "USD", 999999).ok === false, "insufficient transfer fail");
ok(econ.transfer("x", "y", "GHOST", 1).ok === false, "unknown ccy fail");

// 7. Cross-world economy: each currency tied to a world
ok(econ.getCurrency("MOON").worldId === "moon", "MOON tied to moon");
ok(econ.getCurrency("CRED").worldId === "underwater", "CRED tied to underwater");

// Set MOON ↔ CRED rate
econ.setRate("MOON", "CRED", 5);
ok(econ.getRate("MOON", "CRED") === 5, "1 MOON = 5 CRED");
ok(econ.getRate("CRED", "MOON") === 0.2, "auto-inverse");

// 8. Transitive convert (USD → MOON → CRED)
econ.deposit("eve", "USD", 1000);
const conv1 = econ.convert("eve", "USD", "MOON", 200);  // 200 USD → 100 MOON gross → 98 MOON net
ok(conv1.ok === true, "USD → MOON ok");
const conv2 = econ.convert("eve", "MOON", "CRED", 50);  // 50 MOON → 250 CRED gross → 245 net
ok(conv2.ok === true, "MOON → CRED ok");
ok(conv2.netOut === 245, `245 CRED (got ${conv2.netOut})`);

// 9. Audit log
const log = econ.recentLog();
ok(log.length > 5, `audit log populated (${log.length} entries)`);
const kinds = new Set(log.map(l => l.kind));
ok(kinds.has("mint"), "log has mint");
ok(kinds.has("burn"), "log has burn (withdraw)");
ok(kinds.has("convert"), "log has convert");
ok(kinds.has("transfer"), "log has transfer");

// 10. Custom tax rate
const econ2 = E.createEconomy({ taxRate: 0.10 });   // 10% tax
econ2.defineCurrency("X", {});
econ2.deposit("p", "X", 100);
const fee = econ2.transfer("p", "q", "X", 50);
ok(fee.tax === 5, "10% tax on 50 = 5");
ok(fee.sentNet === 45, "net = 45");

// Zero-tax economy
const econ3 = E.createEconomy({ taxRate: 0 });
econ3.defineCurrency("Y", {});
econ3.defineCurrency("Z", {});
econ3.setRate("Y", "Z", 1);
econ3.deposit("p", "Y", 100);
const noTax = econ3.convert("p", "Y", "Z", 50);
ok(noTax.tax === 0, "0% tax");
ok(noTax.netOut === 50, "full amount transferred");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
