
import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v0.14.0/index.ts';
import { assertEquals } from 'https://deno.land/std@0.90.0/testing/asserts.ts';

// ============================================================================
// COMMIT 1: Basic Product Registration and Core Functionality Tests
// ============================================================================

Clarinet.test({
    name: "Test successful product registration",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get("deployer")!;
        const productId = "PROD-001-2025-ABC123";
        const productName = "Premium Coffee Beans";
        const initialLocation = "Coffee Farm, Colombia";

        let block = chain.mineBlock([
            Tx.contractCall(
                "supply-contract",
                "register-product",
                [
                    types.ascii(productId),
                    types.ascii(productName),
                    types.ascii(initialLocation)
                ],
                deployer.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, "(ok true)");
        
        // Verify product was registered correctly
        let getProductBlock = chain.mineBlock([
            Tx.contractCall(
                "supply-contract",
                "get-product",
                [types.ascii(productId)],
                deployer.address
            )
        ]);
        
        const productResult = getProductBlock.receipts[0].result;
        assertEquals(productResult.includes(productName), true);
        assertEquals(productResult.includes(initialLocation), true);
        assertEquals(productResult.includes('"registered"'), true);
    },
});

Clarinet.test({
    name: "Test product registration error handling - duplicate product ID",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get("deployer")!;
        const productId = "DUPLICATE-PROD-123";

        // First registration should succeed
        let block = chain.mineBlock([
            Tx.contractCall(
                "supply-contract",
                "register-product",
                [
                    types.ascii(productId),
                    types.ascii("First Product"),
                    types.ascii("Location A")
                ],
                deployer.address
            )
        ]);
        assertEquals(block.receipts[0].result, "(ok true)");

        // Second registration with same ID should fail
        let duplicateBlock = chain.mineBlock([
            Tx.contractCall(
                "supply-contract",
                "register-product",
                [
                    types.ascii(productId),
                    types.ascii("Second Product"),
                    types.ascii("Location B")
                ],
                deployer.address
            )
        ]);
        assertEquals(duplicateBlock.receipts[0].result, "(err u103)"); // ERR-PRODUCT-EXISTS
    },
});

Clarinet.test({
    name: "Test initial checkpoint creation upon registration",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get("deployer")!;
        const productId = "CHECKPOINT-TEST-001";

        // Register product
        chain.mineBlock([
            Tx.contractCall(
                "supply-contract",
                "register-product",
                [
                    types.ascii(productId),
                    types.ascii("Test Product"),
                    types.ascii("Test Location")
                ],
                deployer.address
            )
        ]);

        // Check checkpoint was created
        let checkpointBlock = chain.mineBlock([
            Tx.contractCall(
                "supply-contract",
                "get-checkpoint",
                [types.ascii(productId), types.uint(1)],
                deployer.address
            )
        ]);
        
        const checkpointResult = checkpointBlock.receipts[0].result;
        assertEquals(checkpointResult.includes('"registered"'), true);
        assertEquals(checkpointResult.includes('Product registered in supply chain'), true);
        
        // Verify checkpoint count
        let countBlock = chain.mineBlock([
            Tx.contractCall(
                "supply-contract",
                "get-checkpoint-count",
                [types.ascii(productId)],
                deployer.address
            )
        ]);
        assertEquals(countBlock.receipts[0].result, "{count: u1}");
    },
});

// ============================================================================
// COMMIT 2: Ownership Transfer and Authorization Tests
// ============================================================================

Clarinet.test({
    name: "Test successful ownership transfer",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get("deployer")!;
        const wallet1 = accounts.get("wallet_1")!;
        const productId = "TRANSFER-TEST-001";

        // Register product first
        chain.mineBlock([
            Tx.contractCall(
                "supply-contract",
                "register-product",
                [
                    types.ascii(productId),
                    types.ascii("Transferable Product"),
                    types.ascii("Initial Location")
                ],
                deployer.address
            )
        ]);

        // Transfer ownership
        let transferBlock = chain.mineBlock([
            Tx.contractCall(
                "supply-contract",
                "transfer-ownership",
                [
                    types.ascii(productId),
                    types.principal(wallet1.address),
                    types.ascii("New Location"),
                    types.ascii("Transferred to distributor")
                ],
                deployer.address
            )
        ]);

        assertEquals(transferBlock.receipts[0].result, "(ok true)");

        // Verify ownership changed
        let productBlock = chain.mineBlock([
            Tx.contractCall(
                "supply-contract",
                "get-product",
                [types.ascii(productId)],
                deployer.address
            )
        ]);
        
        const productResult = productBlock.receipts[0].result;
        assertEquals(productResult.includes(wallet1.address), true);
        assertEquals(productResult.includes('"transferred"'), true);
        assertEquals(productResult.includes('New Location'), true);
    },
});

Clarinet.test({
    name: "Test ownership transfer authorization - only current owner can transfer",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get("deployer")!;
        const wallet1 = accounts.get("wallet_1")!;
        const wallet2 = accounts.get("wallet_2")!;
        const productId = "AUTH-TEST-001";

        // Register product
        chain.mineBlock([
            Tx.contractCall(
                "supply-contract",
                "register-product",
                [
                    types.ascii(productId),
                    types.ascii("Auth Test Product"),
                    types.ascii("Origin Location")
                ],
                deployer.address
            )
        ]);

        // Try to transfer from unauthorized account (should fail)
        let unauthorizedTransfer = chain.mineBlock([
            Tx.contractCall(
                "supply-contract",
                "transfer-ownership",
                [
                    types.ascii(productId),
                    types.principal(wallet2.address),
                    types.ascii("Unauthorized Location"),
                    types.ascii("Unauthorized transfer attempt")
                ],
                wallet1.address  // wallet1 is not the owner
            )
        ]);

        assertEquals(unauthorizedTransfer.receipts[0].result, "(err u101)"); // ERR-NOT-AUTHORIZED
    },
});

Clarinet.test({
    name: "Test ownership transfer for non-existent product",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get("deployer")!;
        const wallet1 = accounts.get("wallet_1")!;

        // Try to transfer non-existent product
        let transferBlock = chain.mineBlock([
            Tx.contractCall(
                "supply-contract",
                "transfer-ownership",
                [
                    types.ascii("NON-EXISTENT-PRODUCT"),
                    types.principal(wallet1.address),
                    types.ascii("Some Location"),
                    types.ascii("Transfer attempt")
                ],
                deployer.address
            )
        ]);

        assertEquals(transferBlock.receipts[0].result, "(err u102)"); // ERR-PRODUCT-NOT-FOUND
    },
});

Clarinet.test({
    name: "Test multiple ownership transfers create proper checkpoint history",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get("deployer")!;
        const wallet1 = accounts.get("wallet_1")!;
        const wallet2 = accounts.get("wallet_2")!;
        const productId = "MULTI-TRANSFER-001";

        // Register product
        chain.mineBlock([
            Tx.contractCall(
                "supply-contract",
                "register-product",
                [
                    types.ascii(productId),
                    types.ascii("Multi Transfer Product"),
                    types.ascii("Factory")
                ],
                deployer.address
            )
        ]);

        // First transfer: deployer -> wallet1
        chain.mineBlock([
            Tx.contractCall(
                "supply-contract",
                "transfer-ownership",
                [
                    types.ascii(productId),
                    types.principal(wallet1.address),
                    types.ascii("Distributor Warehouse"),
                    types.ascii("To distributor")
                ],
                deployer.address
            )
        ]);

        // Second transfer: wallet1 -> wallet2
        chain.mineBlock([
            Tx.contractCall(
                "supply-contract",
                "transfer-ownership",
                [
                    types.ascii(productId),
                    types.principal(wallet2.address),
                    types.ascii("Retail Store"),
                    types.ascii("To retailer")
                ],
                wallet1.address
            )
        ]);

        // Check checkpoint count (should be 3: registration + 2 transfers)
        let countBlock = chain.mineBlock([
            Tx.contractCall(
                "supply-contract",
                "get-checkpoint-count",
                [types.ascii(productId)],
                deployer.address
            )
        ]);
        assertEquals(countBlock.receipts[0].result, "{count: u3}");

        // Verify second checkpoint (first transfer)
        let checkpoint2Block = chain.mineBlock([
            Tx.contractCall(
                "supply-contract",
                "get-checkpoint",
                [types.ascii(productId), types.uint(2)],
                deployer.address
            )
        ]);
        const checkpoint2Result = checkpoint2Block.receipts[0].result;
        assertEquals(checkpoint2Result.includes('To distributor'), true);
        assertEquals(checkpoint2Result.includes('Distributor Warehouse'), true);

        // Verify third checkpoint (second transfer)
        let checkpoint3Block = chain.mineBlock([
            Tx.contractCall(
                "supply-contract",
                "get-checkpoint",
                [types.ascii(productId), types.uint(3)],
                deployer.address
            )
        ]);
        const checkpoint3Result = checkpoint3Block.receipts[0].result;
        assertEquals(checkpoint3Result.includes('To retailer'), true);
        assertEquals(checkpoint3Result.includes(wallet2.address), true);
    },
});

// ============================================================================
// COMMIT 3: Read-only Function Tests and Data Validation
// ============================================================================

Clarinet.test({
    name: "Test get-product function with comprehensive data validation",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get("deployer")!;
        const wallet1 = accounts.get("wallet_1")!;
        const productId = "DATA-VALIDATION-001";
        const productName = "Premium Electronic Device";
        const location = "Manufacturing Plant, Taiwan";

        // Register product
        chain.mineBlock([
            Tx.contractCall(
                "supply-contract",
                "register-product",
                [
                    types.ascii(productId),
                    types.ascii(productName),
                    types.ascii(location)
                ],
                deployer.address
            )
        ]);

        // Test get-product returns complete data
        let productBlock = chain.mineBlock([
            Tx.contractCall(
                "supply-contract",
                "get-product",
                [types.ascii(productId)],
                deployer.address
            )
        ]);

        const productResult = productBlock.receipts[0].result;
        
        // Validate all product fields are present and correct
        assertEquals(productResult.includes(productName), true);
        assertEquals(productResult.includes(deployer.address), true);
        assertEquals(productResult.includes(location), true);
        assertEquals(productResult.includes('"registered"'), true);
        assertEquals(productResult.includes('is-active: true'), true);
        assertEquals(productResult.includes('manufacturer:'), true);
        assertEquals(productResult.includes('current-owner:'), true);
        assertEquals(productResult.includes('timestamp:'), true);

        // Test get-product for non-existent product returns none
        let nonExistentBlock = chain.mineBlock([
            Tx.contractCall(
                "supply-contract",
                "get-product",
                [types.ascii("NON-EXISTENT-PRODUCT")],
                deployer.address
            )
        ]);
        assertEquals(nonExistentBlock.receipts[0].result, "none");
    },
});

Clarinet.test({
    name: "Test get-product-owner function accuracy",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get("deployer")!;
        const wallet1 = accounts.get("wallet_1")!;
        const productId = "OWNER-TEST-001";

        // Register product
        chain.mineBlock([
            Tx.contractCall(
                "supply-contract",
                "register-product",
                [
                    types.ascii(productId),
                    types.ascii("Owner Test Product"),
                    types.ascii("Initial Location")
                ],
                deployer.address
            )
        ]);

        // Test initial owner
        let ownerBlock = chain.mineBlock([
            Tx.contractCall(
                "supply-contract",
                "get-product-owner",
                [types.ascii(productId)],
                deployer.address
            )
        ]);
        assertEquals(ownerBlock.receipts[0].result, `(some ${deployer.address})`);

        // Transfer ownership
        chain.mineBlock([
            Tx.contractCall(
                "supply-contract",
                "transfer-ownership",
                [
                    types.ascii(productId),
                    types.principal(wallet1.address),
                    types.ascii("New Location"),
                    types.ascii("Ownership transfer")
                ],
                deployer.address
            )
        ]);

        // Test new owner
        let newOwnerBlock = chain.mineBlock([
            Tx.contractCall(
                "supply-contract",
                "get-product-owner",
                [types.ascii(productId)],
                deployer.address
            )
        ]);
        assertEquals(newOwnerBlock.receipts[0].result, `(some ${wallet1.address})`);

        // Test non-existent product owner
        let nonExistentOwnerBlock = chain.mineBlock([
            Tx.contractCall(
                "supply-contract",
                "get-product-owner",
                [types.ascii("NON-EXISTENT")],
                deployer.address
            )
        ]);
        assertEquals(nonExistentOwnerBlock.receipts[0].result, "none");
    },
});

Clarinet.test({
    name: "Test checkpoint retrieval and validation across different indices",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get("deployer")!;
        const wallet1 = accounts.get("wallet_1")!;
        const wallet2 = accounts.get("wallet_2")!;
        const productId = "CHECKPOINT-RETRIEVAL-001";

        // Register product
        chain.mineBlock([
            Tx.contractCall(
                "supply-contract",
                "register-product",
                [
                    types.ascii(productId),
                    types.ascii("Checkpoint Test Product"),
                    types.ascii("Factory Location")
                ],
                deployer.address
            )
        ]);

        // First transfer
        chain.mineBlock([
            Tx.contractCall(
                "supply-contract",
                "transfer-ownership",
                [
                    types.ascii(productId),
                    types.principal(wallet1.address),
                    types.ascii("Warehouse"),
                    types.ascii("To distributor")
                ],
                deployer.address
            )
        ]);

        // Second transfer
        chain.mineBlock([
            Tx.contractCall(
                "supply-contract",
                "transfer-ownership",
                [
                    types.ascii(productId),
                    types.principal(wallet2.address),
                    types.ascii("Retail Store"),
                    types.ascii("To retailer")
                ],
                wallet1.address
            )
        ]);

        // Test checkpoint 1 (registration)
        let checkpoint1Block = chain.mineBlock([
            Tx.contractCall(
                "supply-contract",
                "get-checkpoint",
                [types.ascii(productId), types.uint(1)],
                deployer.address
            )
        ]);
        const checkpoint1Result = checkpoint1Block.receipts[0].result;
        assertEquals(checkpoint1Result.includes('Product registered in supply chain'), true);
        assertEquals(checkpoint1Result.includes('Factory Location'), true);
        assertEquals(checkpoint1Result.includes('"registered"'), true);

        // Test checkpoint 2 (first transfer)
        let checkpoint2Block = chain.mineBlock([
            Tx.contractCall(
                "supply-contract",
                "get-checkpoint",
                [types.ascii(productId), types.uint(2)],
                deployer.address
            )
        ]);
        const checkpoint2Result = checkpoint2Block.receipts[0].result;
        assertEquals(checkpoint2Result.includes('To distributor'), true);
        assertEquals(checkpoint2Result.includes('Warehouse'), true);
        assertEquals(checkpoint2Result.includes(deployer.address), true);
        assertEquals(checkpoint2Result.includes(wallet1.address), true);

        // Test checkpoint 3 (second transfer)
        let checkpoint3Block = chain.mineBlock([
            Tx.contractCall(
                "supply-contract",
                "get-checkpoint",
                [types.ascii(productId), types.uint(3)],
                deployer.address
            )
        ]);
        const checkpoint3Result = checkpoint3Block.receipts[0].result;
        assertEquals(checkpoint3Result.includes('To retailer'), true);
        assertEquals(checkpoint3Result.includes('Retail Store'), true);
        assertEquals(checkpoint3Result.includes(wallet1.address), true);
        assertEquals(checkpoint3Result.includes(wallet2.address), true);

        // Test non-existent checkpoint
        let nonExistentCheckpointBlock = chain.mineBlock([
            Tx.contractCall(
                "supply-contract",
                "get-checkpoint",
                [types.ascii(productId), types.uint(10)],
                deployer.address
            )
        ]);
        assertEquals(nonExistentCheckpointBlock.receipts[0].result, "none");
    },
});

Clarinet.test({
    name: "Test get-total-products counter functionality",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get("deployer")!;

        // Check initial total products (should be 0 for clean state)
        let initialTotalBlock = chain.mineBlock([
            Tx.contractCall(
                "supply-contract",
                "get-total-products",
                [],
                deployer.address
            )
        ]);
        
        // Register first product
        chain.mineBlock([
            Tx.contractCall(
                "supply-contract",
                "register-product",
                [
                    types.ascii("TOTAL-COUNT-001"),
                    types.ascii("First Product"),
                    types.ascii("Location 1")
                ],
                deployer.address
            )
        ]);

        // Register second product
        chain.mineBlock([
            Tx.contractCall(
                "supply-contract",
                "register-product",
                [
                    types.ascii("TOTAL-COUNT-002"),
                    types.ascii("Second Product"),
                    types.ascii("Location 2")
                ],
                deployer.address
            )
        ]);

        // Register third product
        chain.mineBlock([
            Tx.contractCall(
                "supply-contract",
                "register-product",
                [
                    types.ascii("TOTAL-COUNT-003"),
                    types.ascii("Third Product"),
                    types.ascii("Location 3")
                ],
                deployer.address
            )
        ]);

        // Check final total products count
        let finalTotalBlock = chain.mineBlock([
            Tx.contractCall(
                "supply-contract",
                "get-total-products",
                [],
                deployer.address
            )
        ]);

        // The total should be at least 3 (could be higher if previous tests ran)
        const totalResult = finalTotalBlock.receipts[0].result;
        const totalNumber = parseInt(totalResult.replace('u', ''));
        assertEquals(totalNumber >= 3, true);
    },
});

Clarinet.test({
    name: "Test get-checkpoint-count accuracy across different products",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get("deployer")!;
        const wallet1 = accounts.get("wallet_1")!;
        const product1 = "COUNT-TEST-001";
        const product2 = "COUNT-TEST-002";

        // Register first product (1 checkpoint)
        chain.mineBlock([
            Tx.contractCall(
                "supply-contract",
                "register-product",
                [
                    types.ascii(product1),
                    types.ascii("Product One"),
                    types.ascii("Location One")
                ],
                deployer.address
            )
        ]);

        // Register second product (1 checkpoint)
        chain.mineBlock([
            Tx.contractCall(
                "supply-contract",
                "register-product",
                [
                    types.ascii(product2),
                    types.ascii("Product Two"),
                    types.ascii("Location Two")
                ],
                deployer.address
            )
        ]);

        // Transfer first product once (adds 1 checkpoint, total 2)
        chain.mineBlock([
            Tx.contractCall(
                "supply-contract",
                "transfer-ownership",
                [
                    types.ascii(product1),
                    types.principal(wallet1.address),
                    types.ascii("New Location One"),
                    types.ascii("First transfer")
                ],
                deployer.address
            )
        ]);

        // Check counts
        let count1Block = chain.mineBlock([
            Tx.contractCall(
                "supply-contract",
                "get-checkpoint-count",
                [types.ascii(product1)],
                deployer.address
            )
        ]);
        assertEquals(count1Block.receipts[0].result, "{count: u2}");

        let count2Block = chain.mineBlock([
            Tx.contractCall(
                "supply-contract",
                "get-checkpoint-count",
                [types.ascii(product2)],
                deployer.address
            )
        ]);
        assertEquals(count2Block.receipts[0].result, "{count: u1}");

        // Check count for non-existent product
        let nonExistentCountBlock = chain.mineBlock([
            Tx.contractCall(
                "supply-contract",
                "get-checkpoint-count",
                [types.ascii("NON-EXISTENT")],
                deployer.address
            )
        ]);
        assertEquals(nonExistentCountBlock.receipts[0].result, "{count: u0}");
    },
});

// ============================================================================
// COMMIT 4: Advanced Integration Tests and Complex Scenarios
// ============================================================================

Clarinet.test({
    name: "Test complex supply chain scenario with multiple products and transfers",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get("deployer")!;
        const manufacturer = accounts.get("wallet_1")!;
        const distributor = accounts.get("wallet_2")!;
        const retailer = accounts.get("wallet_3")!;
        
        const products = ["COMPLEX-001", "COMPLEX-002", "COMPLEX-003"];

        // Register multiple products from different manufacturers
        chain.mineBlock([
            Tx.contractCall("supply-contract", "register-product", 
                [types.ascii(products[0]), types.ascii("Product A"), types.ascii("Factory A")], 
                deployer.address),
            Tx.contractCall("supply-contract", "register-product", 
                [types.ascii(products[1]), types.ascii("Product B"), types.ascii("Factory B")], 
                manufacturer.address),
            Tx.contractCall("supply-contract", "register-product", 
                [types.ascii(products[2]), types.ascii("Product C"), types.ascii("Factory C")], 
                deployer.address)
        ]);

        // Execute complex transfer chains
        chain.mineBlock([
            // Product A: deployer -> distributor
            Tx.contractCall("supply-contract", "transfer-ownership", 
                [types.ascii(products[0]), types.principal(distributor.address), 
                 types.ascii("Distributor Hub"), types.ascii("To distributor")], 
                deployer.address),
            // Product B: manufacturer -> retailer (direct)
            Tx.contractCall("supply-contract", "transfer-ownership", 
                [types.ascii(products[1]), types.principal(retailer.address), 
                 types.ascii("Retail Store"), types.ascii("Direct to retailer")], 
                manufacturer.address)
        ]);

        // Second round of transfers
        chain.mineBlock([
            // Product A: distributor -> retailer
            Tx.contractCall("supply-contract", "transfer-ownership", 
                [types.ascii(products[0]), types.principal(retailer.address), 
                 types.ascii("Final Store"), types.ascii("Final destination")], 
                distributor.address),
            // Product C: deployer -> manufacturer
            Tx.contractCall("supply-contract", "transfer-ownership", 
                [types.ascii(products[2]), types.principal(manufacturer.address), 
                 types.ascii("Processing Center"), types.ascii("For processing")], 
                deployer.address)
        ]);

        // Verify final states and checkpoint counts
        let productAOwner = chain.mineBlock([
            Tx.contractCall("supply-contract", "get-product-owner", 
                [types.ascii(products[0])], deployer.address)
        ]);
        assertEquals(productAOwner.receipts[0].result, `(some ${retailer.address})`);

        let productACheckpoints = chain.mineBlock([
            Tx.contractCall("supply-contract", "get-checkpoint-count", 
                [types.ascii(products[0])], deployer.address)
        ]);
        assertEquals(productACheckpoints.receipts[0].result, "{count: u3}"); // registration + 2 transfers

        let productBCheckpoints = chain.mineBlock([
            Tx.contractCall("supply-contract", "get-checkpoint-count", 
                [types.ascii(products[1])], deployer.address)
        ]);
        assertEquals(productBCheckpoints.receipts[0].result, "{count: u2}"); // registration + 1 transfer
    },
});

Clarinet.test({
    name: "Test edge case: Maximum length strings and data validation",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get("deployer")!;
        const wallet1 = accounts.get("wallet_1")!;
        
        // Test with maximum length strings
        const maxProductId = "ABCD-1234-EFGH-5678-IJKL-9012-MNOP-Q"; // 36 chars exactly
        const maxProductName = "A".repeat(100); // 100 chars max
        const maxLocation = "B".repeat(100); // 100 chars max
        const maxNotes = "C".repeat(500); // 500 chars max

        // Register with maximum length data
        let registerBlock = chain.mineBlock([
            Tx.contractCall(
                "supply-contract",
                "register-product",
                [
                    types.ascii(maxProductId),
                    types.ascii(maxProductName),
                    types.ascii(maxLocation)
                ],
                deployer.address
            )
        ]);
        assertEquals(registerBlock.receipts[0].result, "(ok true)");

        // Transfer with maximum length notes
        let transferBlock = chain.mineBlock([
            Tx.contractCall(
                "supply-contract",
                "transfer-ownership",
                [
                    types.ascii(maxProductId),
                    types.principal(wallet1.address),
                    types.ascii(maxLocation),
                    types.ascii(maxNotes)
                ],
                deployer.address
            )
        ]);
        assertEquals(transferBlock.receipts[0].result, "(ok true)");

        // Verify data integrity with max length strings
        let productBlock = chain.mineBlock([
            Tx.contractCall(
                "supply-contract",
                "get-product",
                [types.ascii(maxProductId)],
                deployer.address
            )
        ]);
        const result = productBlock.receipts[0].result;
        assertEquals(result.includes(wallet1.address), true);
        assertEquals(result.includes('"transferred"'), true);
    },
});

Clarinet.test({
    name: "Test concurrent operations and state consistency",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get("deployer")!;
        const wallet1 = accounts.get("wallet_1")!;
        const wallet2 = accounts.get("wallet_2")!;
        const wallet3 = accounts.get("wallet_3")!;

        const products = ["CONCURRENT-001", "CONCURRENT-002", "CONCURRENT-003"];

        // Register multiple products concurrently in same block
        let registerBlock = chain.mineBlock([
            Tx.contractCall("supply-contract", "register-product", 
                [types.ascii(products[0]), types.ascii("Concurrent A"), types.ascii("Location A")], 
                deployer.address),
            Tx.contractCall("supply-contract", "register-product", 
                [types.ascii(products[1]), types.ascii("Concurrent B"), types.ascii("Location B")], 
                wallet1.address),
            Tx.contractCall("supply-contract", "register-product", 
                [types.ascii(products[2]), types.ascii("Concurrent C"), types.ascii("Location C")], 
                wallet2.address)
        ]);
        
        // All registrations should succeed
        assertEquals(registerBlock.receipts.length, 3);
        assertEquals(registerBlock.receipts[0].result, "(ok true)");
        assertEquals(registerBlock.receipts[1].result, "(ok true)");
        assertEquals(registerBlock.receipts[2].result, "(ok true)");

        // Multiple transfers in same block
        let transferBlock = chain.mineBlock([
            Tx.contractCall("supply-contract", "transfer-ownership", 
                [types.ascii(products[0]), types.principal(wallet1.address), 
                 types.ascii("New Location A"), types.ascii("Transfer A")], 
                deployer.address),
            Tx.contractCall("supply-contract", "transfer-ownership", 
                [types.ascii(products[1]), types.principal(wallet2.address), 
                 types.ascii("New Location B"), types.ascii("Transfer B")], 
                wallet1.address),
            Tx.contractCall("supply-contract", "transfer-ownership", 
                [types.ascii(products[2]), types.principal(wallet3.address), 
                 types.ascii("New Location C"), types.ascii("Transfer C")], 
                wallet2.address)
        ]);

        // All transfers should succeed
        assertEquals(transferBlock.receipts.length, 3);
        assertEquals(transferBlock.receipts[0].result, "(ok true)");
        assertEquals(transferBlock.receipts[1].result, "(ok true)");
        assertEquals(transferBlock.receipts[2].result, "(ok true)");

        // Verify state consistency after concurrent operations
        let ownerCheckBlock = chain.mineBlock([
            Tx.contractCall("supply-contract", "get-product-owner", 
                [types.ascii(products[0])], deployer.address),
            Tx.contractCall("supply-contract", "get-product-owner", 
                [types.ascii(products[1])], deployer.address),
            Tx.contractCall("supply-contract", "get-product-owner", 
                [types.ascii(products[2])], deployer.address)
        ]);

        assertEquals(ownerCheckBlock.receipts[0].result, `(some ${wallet1.address})`);
        assertEquals(ownerCheckBlock.receipts[1].result, `(some ${wallet2.address})`);
        assertEquals(ownerCheckBlock.receipts[2].result, `(some ${wallet3.address})`);
    },
});

Clarinet.test({
    name: "Test comprehensive error handling and boundary conditions",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get("deployer")!;
        const wallet1 = accounts.get("wallet_1")!;

        // Test error conditions in batch
        let errorTestBlock = chain.mineBlock([
            // Try to transfer non-existent product
            Tx.contractCall("supply-contract", "transfer-ownership", 
                [types.ascii("NON-EXISTENT-PRODUCT"), types.principal(wallet1.address), 
                 types.ascii("Some Location"), types.ascii("Invalid transfer")], 
                deployer.address),
            // Register a product for further testing
            Tx.contractCall("supply-contract", "register-product", 
                [types.ascii("ERROR-TEST-001"), types.ascii("Error Test Product"), 
                 types.ascii("Test Location")], deployer.address),
            // Try to register duplicate product (should fail)
            Tx.contractCall("supply-contract", "register-product", 
                [types.ascii("ERROR-TEST-001"), types.ascii("Duplicate Product"), 
                 types.ascii("Duplicate Location")], deployer.address)
        ]);

        // Verify error responses
        assertEquals(errorTestBlock.receipts[0].result, "(err u102)"); // ERR-PRODUCT-NOT-FOUND
        assertEquals(errorTestBlock.receipts[1].result, "(ok true)");   // Successful registration
        assertEquals(errorTestBlock.receipts[2].result, "(err u103)"); // ERR-PRODUCT-EXISTS

        // Test unauthorized transfer after valid registration
        let unauthorizedBlock = chain.mineBlock([
            Tx.contractCall("supply-contract", "transfer-ownership", 
                [types.ascii("ERROR-TEST-001"), types.principal(wallet1.address), 
                 types.ascii("Unauthorized Location"), types.ascii("Unauthorized attempt")], 
                wallet1.address) // wallet1 is not the owner
        ]);
        assertEquals(unauthorizedBlock.receipts[0].result, "(err u101)"); // ERR-NOT-AUTHORIZED

        // Verify product data remains unchanged after failed operations
        let verifyBlock = chain.mineBlock([
            Tx.contractCall("supply-contract", "get-product", 
                [types.ascii("ERROR-TEST-001")], deployer.address)
        ]);
        const productResult = verifyBlock.receipts[0].result;
        assertEquals(productResult.includes(deployer.address), true);
        assertEquals(productResult.includes('"registered"'), true);
    },
});

Clarinet.test({
    name: "Test complete supply chain audit trail functionality",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get("deployer")!;
        const processor = accounts.get("wallet_1")!;
        const distributor = accounts.get("wallet_2")!;
        const retailer = accounts.get("wallet_3")!;
        const productId = "AUDIT-TRAIL-001";

        // Complete product lifecycle
        chain.mineBlock([
            Tx.contractCall("supply-contract", "register-product", 
                [types.ascii(productId), types.ascii("Audit Trail Product"), 
                 types.ascii("Raw Materials Facility")], deployer.address)
        ]);

        chain.mineBlock([
            Tx.contractCall("supply-contract", "transfer-ownership", 
                [types.ascii(productId), types.principal(processor.address), 
                 types.ascii("Processing Facility"), 
                 types.ascii("Transferred for processing and quality control")], 
                deployer.address)
        ]);

        chain.mineBlock([
            Tx.contractCall("supply-contract", "transfer-ownership", 
                [types.ascii(productId), types.principal(distributor.address), 
                 types.ascii("Distribution Center"), 
                 types.ascii("Quality approved, ready for distribution")], 
                processor.address)
        ]);

        chain.mineBlock([
            Tx.contractCall("supply-contract", "transfer-ownership", 
                [types.ascii(productId), types.principal(retailer.address), 
                 types.ascii("Retail Store Floor"), 
                 types.ascii("Final destination - ready for consumer purchase")], 
                distributor.address)
        ]);

        // Audit the complete trail
        let checkpointCount = chain.mineBlock([
            Tx.contractCall("supply-contract", "get-checkpoint-count", 
                [types.ascii(productId)], deployer.address)
        ]);
        assertEquals(checkpointCount.receipts[0].result, "{count: u4}");

        // Verify each checkpoint in the trail
        let checkpoint1 = chain.mineBlock([
            Tx.contractCall("supply-contract", "get-checkpoint", 
                [types.ascii(productId), types.uint(1)], deployer.address)
        ]);
        assertEquals(checkpoint1.receipts[0].result.includes("Product registered in supply chain"), true);

        let checkpoint2 = chain.mineBlock([
            Tx.contractCall("supply-contract", "get-checkpoint", 
                [types.ascii(productId), types.uint(2)], deployer.address)
        ]);
        assertEquals(checkpoint2.receipts[0].result.includes("processing and quality control"), true);

        let checkpoint3 = chain.mineBlock([
            Tx.contractCall("supply-contract", "get-checkpoint", 
                [types.ascii(productId), types.uint(3)], deployer.address)
        ]);
        assertEquals(checkpoint3.receipts[0].result.includes("Quality approved"), true);

        let checkpoint4 = chain.mineBlock([
            Tx.contractCall("supply-contract", "get-checkpoint", 
                [types.ascii(productId), types.uint(4)], deployer.address)
        ]);
        assertEquals(checkpoint4.receipts[0].result.includes("consumer purchase"), true);

        // Verify final product state
        let finalState = chain.mineBlock([
            Tx.contractCall("supply-contract", "get-product", 
                [types.ascii(productId)], deployer.address)
        ]);
        const finalResult = finalState.receipts[0].result;
        assertEquals(finalResult.includes(retailer.address), true);
        assertEquals(finalResult.includes("Retail Store Floor"), true);
        assertEquals(finalResult.includes('"transferred"'), true);
    },
});
