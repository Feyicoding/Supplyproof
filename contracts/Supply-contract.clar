
;; SupplyProof Contract
;; Supply chain tracking contract that records each product checkpoint, 
;; ensuring authenticity and traceability.

;; constants
(define-constant CONTRACT-OWNER tx-sender)
(define-constant ERR-NOT-AUTHORIZED (err u101))
(define-constant ERR-PRODUCT-NOT-FOUND (err u102))
(define-constant ERR-PRODUCT-EXISTS (err u103))
(define-constant ERR-INVALID-OWNER (err u104))
(define-constant ERR-INVALID-STATUS (err u105))

;; data maps and vars
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

;; private functions
;;

;; public functions
;;
