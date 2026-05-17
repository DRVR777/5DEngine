// test_iter_101.js — marketplace search/filter: queries, sort, facets, adapters.
const M = require("./marketplace_search.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

// 1. createIndex + addListing
const idx = M.createIndex();
ok(idx.size() === 0, "empty");
ok(idx.addListing({ id: "a", name: "Apple", price: 5, ccy: "coin" }).ok, "add");
ok(idx.addListing(null).ok === false, "null rejected");
ok(idx.addListing({}).ok === false, "missing id rejected");
ok(idx.size() === 1, "size 1");

// 2. addAll
idx.addAll([
  { id: "b", name: "Berry",      price: 10, ccy: "coin", tags: ["fruit", "red"], category: "food" },
  { id: "c", name: "Carrot",     price: 3,  ccy: "coin", tags: ["veg"],          category: "food" },
  { id: "d", name: "Diamond",    price: 1000, ccy: "gem",  tags: ["rare"],        category: "treasure" },
  { id: "e", name: "Eagle Bow",  price: 250, ccy: "coin", tags: ["weapon", "bow"], category: "weapon", rating: 4 },
  { id: "f", name: "Fire Sword", price: 500, ccy: "coin", tags: ["weapon", "fire"], category: "weapon", rating: 5 },
  { id: "g", name: "Glass Bow",  price: 100, ccy: "coin", tags: ["weapon", "bow"], category: "weapon", rating: 2 },
]);
ok(idx.size() === 7, "7 items");

// 3. Empty query returns all
const r1 = idx.search({});
ok(r1.total === 7, "all returned");

// 4. Text search
ok(idx.search({ text: "bow" }).total === 2, "text bow → 2");
ok(idx.search({ text: "BOW" }).total === 2, "case-insensitive");
ok(idx.search({ text: "fire" }).total === 1, "fire");

// 5. Tag filter (ALL must match)
ok(idx.search({ tags: ["weapon"] }).total === 3, "weapon tag → 3");
ok(idx.search({ tags: ["weapon", "bow"] }).total === 2, "weapon+bow → 2");
ok(idx.search({ tags: ["weapon", "rare"] }).total === 0, "no weapon+rare overlap");

// 6. anyTags (OR)
ok(idx.search({ anyTags: ["bow", "rare"] }).total === 3, "bow OR rare → 3");
ok(idx.search({ anyTags: [] }).total === 7, "empty anyTags = no filter");

// 7. Category
ok(idx.search({ category: "weapon" }).total === 3, "category weapon");
ok(idx.search({ category: "ghost" }).total === 0, "unknown category");

// 8. Price range
ok(idx.search({ minPrice: 100 }).total === 4, "minPrice 100 → 4");
ok(idx.search({ maxPrice: 10 }).total === 3, "maxPrice 10 → 3 (a, b, c)");
ok(idx.search({ minPrice: 100, maxPrice: 500 }).total === 3, "100-500 → 3");

// 9. CCY
ok(idx.search({ ccy: "coin" }).total === 6, "coin only");
ok(idx.search({ ccy: "gem" }).total === 1, "gem only");

// 10. minRating
ok(idx.search({ minRating: 4 }).total === 2, "rating ≥ 4 → 2");
ok(idx.search({ minRating: 6 }).total === 0, "rating ≥ 6 → 0");

// 11. Combined filters
const c1 = idx.search({ category: "weapon", maxPrice: 200 });
ok(c1.total === 1 && c1.page[0].id === "g", "weapon + maxPrice 200 → glass bow");

// 12. Sort by price ASC
const sAsc = idx.search({}, { by: "price", dir: "asc" });
ok(sAsc.page[0].price === 3, "first cheapest = 3 (carrot)");
ok(sAsc.page[sAsc.page.length - 1].price === 1000, "last most expensive");

// 13. Sort by price DESC
const sDesc = idx.search({}, { by: "price", dir: "desc" });
ok(sDesc.page[0].price === 1000, "first = diamond");

// 14. Sort by name
const sName = idx.search({}, { by: "name" });
ok(sName.page[0].name === "Apple", "Apple first alphabetically");

// 15. Sort by rating DESC
const sRate = idx.search({ category: "weapon" }, { by: "rating", dir: "desc" });
ok(sRate.page[0].id === "f", "Fire Sword tops weapons by rating");

// 16. Pagination
const p1 = idx.search({}, { by: "price" }, { limit: 3, offset: 0 });
ok(p1.page.length === 3, "page 1 = 3");
ok(p1.total === 7, "total = 7");
const p2 = idx.search({}, { by: "price" }, { limit: 3, offset: 3 });
ok(p2.page.length === 3, "page 2 = 3");
const p3 = idx.search({}, { by: "price" }, { limit: 3, offset: 6 });
ok(p3.page.length === 1, "page 3 = 1");

// 17. Facets
const f1 = idx.search({ facetsOf: ["category", "ccy"] });
ok(f1.facets.category.weapon === 3, "facet weapon = 3");
ok(f1.facets.category.food === 2, "facet food = 2");
ok(f1.facets.ccy.coin === 6, "facet coin = 6");
ok(f1.facets.ccy.gem === 1, "facet gem = 1");

const fT = idx.search({ facetsOf: ["tags"] });
ok(fT.facets.tags.weapon === 3, "facet tag weapon = 3");
ok(fT.facets.tags.bow === 2, "facet tag bow = 2");

// 18. removeListing
ok(idx.removeListing("a") === true, "remove a");
ok(idx.size() === 6, "size 6");
ok(idx.getListing("a") === null, "a gone");

// 19. clear
const idx2 = M.createIndex();
idx2.addListing({ id: "x", name: "X" });
idx2.clear();
ok(idx2.size() === 0, "cleared");

// 20. listAll
ok(idx.listAll().length === 6, "listAll = 6");

// 21. Adapters
// Trading post adapter
const tradeOffer = {
  id: "off_1", itemId: "sword", sellerId: "alice",
  askingCcy: "coin", askingAmount: 100, qty: 1,
  state: "open", createdAt: 12345,
};
const norm1 = M.fromTradingPostOffer(tradeOffer);
ok(norm1.id === "off_1", "trade adapter: id");
ok(norm1.name === "sword", "trade adapter: name=itemId");
ok(norm1.price === 100, "trade adapter: price");
ok(norm1.category === "trade_offer", "trade adapter: category");

// Mod adapter
const mod = {
  id: "epic_mod", name: "Epic Mod", price: 50, ccy: "coin",
  sellerId: "x", rating: 4.5, downloads: 100, listedAt: 999,
};
const norm2 = M.fromModListing(mod);
ok(norm2.category === "mod", "mod adapter category");
ok(norm2.downloads === 100, "mod adapter downloads");
ok(norm2.createdAt === 999, "mod adapter createdAt from listedAt");

// Shop adapter
const shopItem = { id: "potion_red", name: "Red Potion", price: 5, category: "consumable", stock: 50 };
const norm3 = M.fromShopItem(shopItem);
ok(norm3.sellerId === "shop", "shop adapter seller");
ok(norm3.category === "consumable", "shop adapter category");
ok(norm3.meta.stock === 50, "shop adapter stock in meta");

// 22. Use adapters with index
const adapterIdx = M.createIndex();
adapterIdx.addListing(M.fromTradingPostOffer(tradeOffer));
adapterIdx.addListing(M.fromModListing(mod));
adapterIdx.addListing(M.fromShopItem(shopItem));
ok(adapterIdx.size() === 3, "3 from different adapters");
ok(adapterIdx.search({ category: "mod" }).total === 1, "find mods");
ok(adapterIdx.search({ category: "trade_offer" }).total === 1, "find trade offers");

// 23. Sort by createdAt
const created = idx.search({ category: "food" }, { by: "createdAt", dir: "asc" });
ok(created.page.length === 2, "2 food items");

// 24. Default limit
const big = M.createIndex();
for (let i = 0; i < 200; i++) big.addListing({ id: "x" + i, name: "Item " + i, price: i });
const r = big.search({});
ok(r.total === 200, "200 total");
ok(r.page.length === 100, "default limit 100");

// 25. Faceted query returns facets only when requested
const noFacets = idx.search({});
ok(noFacets.facets === undefined, "no facets without facetsOf");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
