// entity.js — single envelope shape for every entity in 5DEngine.
//
// Per "How to Be Modular": one table, one envelope, one registry.
//   { $header: { $type, $facets, $version }, <facet>: {...}, ... }
//
// Adding a new entity type = register a parser + a component + a renderer.
// Never edit a central switch. UMD: works in Node and browser.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTAEntity = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function createEntity(type, facets) {
    facets = facets || {};
    const facetNames = Object.keys(facets);
    const e = {
      $header: { $type: type, $facets: facetNames, $version: 1 },
    };
    for (const name of facetNames) e[name] = facets[name];
    return e;
  }

  function addFacet(entity, name, data) {
    entity[name] = data;
    if (!entity.$header.$facets.includes(name)) {
      entity.$header.$facets.push(name);
    }
    entity.$header.$version++;
  }

  function removeFacet(entity, name) {
    delete entity[name];
    entity.$header.$facets = entity.$header.$facets.filter(f => f !== name);
    entity.$header.$version++;
  }

  function getFacet(entity, name) {
    return entity[name];
  }

  function hasFacet(entity, name) {
    return entity.$header.$facets.includes(name);
  }

  function clone(entity) {
    return JSON.parse(JSON.stringify(entity));
  }

  return { createEntity, addFacet, removeFacet, getFacet, hasFacet, clone };
});
