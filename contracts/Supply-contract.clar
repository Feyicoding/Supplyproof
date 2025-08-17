;; SupplyProof Contract
;; Supply chain tracking contract that records each product checkpoint, 
;; ensuring authenticity and traceability.

;; Error constants
(define-constant ERR-NOT-AUTHORIZED (err u101))
(define-constant ERR-PRODUCT-NOT-FOUND (err u102))
(define-constant ERR-PRODUCT-EXISTS (err u103))
(define-constant ERR-INVALID-OWNER (err u104))
(define-constant ERR-INVALID-STATUS (err u105))

;; Data maps and vars
;; Map to store product information
(define-map products
  { product-id: (string-ascii 36) }
  {
    name: (string-ascii 100),
    manufacturer: principal,
    current-owner: principal,
    status: (string-ascii 50),
    location: (string-ascii 100),
    timestamp: uint,
    is-active: bool
  }
)

;; Map to store product checkpoint history
(define-map product-checkpoints
  { product-id: (string-ascii 36), checkpoint-index: uint }
  {
    handler: principal,
    previous-owner: principal,
    new-owner: principal,
    status: (string-ascii 50),
    location: (string-ascii 100),
    timestamp: uint,
    notes: (string-ascii 500)
  }
)

;; Map to track checkpoint counts for each product
(define-map checkpoint-counters
  { product-id: (string-ascii 36) }
  { count: uint }
)

;; Variable to track total number of products registered
(define-data-var total-products uint u0)

;; Private functions
;; Helper function to generate the next checkpoint index for a product
(define-private (get-next-checkpoint-index (product-id (string-ascii 36)))
  (let ((current-count (default-to { count: u0 } (map-get? checkpoint-counters { product-id: product-id }))))
    (+ (get count current-count) u1)
  )
)

;; Helper function to increment checkpoint counter
(define-private (increment-checkpoint-counter (product-id (string-ascii 36)))
  (let ((current-count (default-to { count: u0 } (map-get? checkpoint-counters { product-id: product-id }))))
    (map-set checkpoint-counters
      { product-id: product-id }
      { count: (+ (get count current-count) u1) }
    )
  )
)

;; Public functions
;; Function to register a new product in the supply chain
(define-public (register-product
  (product-id (string-ascii 36))
  (name (string-ascii 100))
  (initial-location (string-ascii 100))
)
  (let ((existing-product (map-get? products { product-id: product-id })))
    (if (is-some existing-product)
      ERR-PRODUCT-EXISTS
      (begin
        ;; Create the product record
        (map-set products
          { product-id: product-id }
          {
            name: name,
            manufacturer: tx-sender,
            current-owner: tx-sender,
            status: "registered",
            location: initial-location,
            timestamp: block-height,
            is-active: true
          }
        )
        ;; Initialize checkpoint counter
        (map-set checkpoint-counters
          { product-id: product-id }
          { count: u1 }
        )
        ;; Record the initial checkpoint
        (map-set product-checkpoints
          { product-id: product-id, checkpoint-index: u1 }
          {
            handler: tx-sender,
            previous-owner: tx-sender,
            new-owner: tx-sender,
            status: "registered",
            location: initial-location,
            timestamp: block-height,
            notes: "Product registered in supply chain"
          }
        )
        ;; Increment total products counter
        (var-set total-products (+ (var-get total-products) u1))
        (ok true)
      )
    )
  )
)

;; Function to transfer product ownership
(define-public (transfer-ownership
  (product-id (string-ascii 36))
  (new-owner principal)
  (new-location (string-ascii 100))
  (notes (string-ascii 500))
)
  (let ((product (map-get? products { product-id: product-id })))
    (match product
      existing-product
      (if (is-eq tx-sender (get current-owner existing-product))
        (let ((checkpoint-index (get-next-checkpoint-index product-id)))
          ;; Update product ownership and location
          (map-set products
            { product-id: product-id }
            (merge existing-product {
              current-owner: new-owner,
              location: new-location,
              timestamp: block-height,
              status: "transferred"
            })
          )
          ;; Record ownership transfer checkpoint
          (map-set product-checkpoints
            { product-id: product-id, checkpoint-index: checkpoint-index }
            {
              handler: tx-sender,
              previous-owner: (get current-owner existing-product),
              new-owner: new-owner,
              status: "transferred",
              location: new-location,
              timestamp: block-height,
              notes: notes
            }
          )
          ;; Increment checkpoint counter
          (increment-checkpoint-counter product-id)
          (ok true)
        )
        ERR-NOT-AUTHORIZED
      )
      ERR-PRODUCT-NOT-FOUND
    )
  )
)

;; Read-only functions
;; Function to get product details
(define-read-only (get-product (product-id (string-ascii 36)))
  (map-get? products { product-id: product-id })
)

;; Function to get a specific checkpoint
(define-read-only (get-checkpoint 
  (product-id (string-ascii 36))
  (checkpoint-index uint)
)
  (map-get? product-checkpoints 
    { product-id: product-id, checkpoint-index: checkpoint-index }
  )
)

;; Function to get the total number of checkpoints for a product
(define-read-only (get-checkpoint-count (product-id (string-ascii 36)))
  (default-to { count: u0 } (map-get? checkpoint-counters { product-id: product-id }))
)

;; Function to get current owner of a product
(define-read-only (get-product-owner (product-id (string-ascii 36)))
  (match (map-get? products { product-id: product-id })
    product-data (some (get current-owner product-data))
    none
  )
)

;; Function to get total number of products registered
(define-read-only (get-total-products)
  (var-get total-products)
)