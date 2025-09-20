
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
