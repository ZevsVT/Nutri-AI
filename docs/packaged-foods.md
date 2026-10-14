# Packaged products and reviewed barcodes

This branch did not contain the issue #17 packaged-food importer or persistence
mentioned in issue #18. The review implementation adds `PackagedProduct` and
`FoodBarcode` alongside the canonical `Food` model. There is one product per food;
no parallel catalog or importer is introduced.

Create a packaged food through a CREATE_FOOD proposal with permanent brand,
formulation and trusted source identity. Reviewed corrections can change product
display name, package quantity/unit, lifecycle and barcode availability. Nutrition
must use the product's source; publication sets its current nutrition version,
and withdrawal clears it. See [food reviews](food-reviews.md) for payloads, evidence,
approval rules and account provisioning.

Barcode mappings use validated check digits and canonical 14-digit GTIN keys.
Lifecycle changes retain mapping ownership; ordinary review cannot reassign a
barcode. Deactivated food/mappings do not resolve through public barcode scan,
including fallback to an external provider for a known inactive mapping.

There is no `packaged-food-import.ts` in this checkout to reuse or test. Before
integrating a future importer, use these tables, normalization and barcode helpers,
retain source/version and ownership constraints, and test concurrent direct writes
against review approval. PostgreSQL catalog table locks and complete baseline
fingerprints coordinate ordinary transactional maintenance writes today. Do not
claim that all catalog writes require review; database operators and existing seeds
remain trusted direct-write paths.
