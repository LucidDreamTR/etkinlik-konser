// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title EventTicket
 * @dev An ERC721 token contract for event tickets with advanced features.
 * - Implements ERC721URIStorage for metadata management.
 * - Uses AccessControl for role-based permissions (MINTER_ROLE).
 * - Protects against replay attacks using a mapping of used payment IDs.
 */
contract EventTicket is ERC721, ERC721URIStorage, AccessControl {
    uint256 private _tokenIdCounter;

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    enum EventState {
        CREATED,
        ACTIVE,
        CHECKIN,
        CLOSED
    }

    mapping(bytes32 => bool) public usedPaymentIds;
    mapping(uint256 => bytes32) private _tokenPaymentIds;
    mapping(uint256 => EventState) public eventStates;

    struct TicketMeta {
        uint256 eventId;
        bool claimed;
        bytes32 rulesHash;
        address payoutSplitter;
        uint8 transferPolicy;
        EventState eventState;
    }
    mapping(uint256 => TicketMeta) public tickets;

    /**
     * @dev Sets up the contract, granting admin role to an initial address.
     * @param name The name of the token collection.
     * @param symbol The symbol of the token collection.
     * @param initialAdmin The address to grant initial admin rights.
     */
    constructor(string memory name, string memory symbol, address initialAdmin) ERC721(name, symbol) {
        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
    }

    /**
     * @dev Mints a new ticket, assigns it a URI and event ID.
     * Only callable by addresses with the MINTER_ROLE.
     * Reverts if the paymentId has already been used.
     * @param to The address to mint the ticket to.
     * @param uri The metadata URI for the token.
     * @param eventId The ID of the event this ticket is for.
     * @param paymentId A unique ID from the payment provider to prevent replay attacks.
     */
    function safeMint(address to, string memory uri, uint256 eventId, bytes32 paymentId) public onlyRole(MINTER_ROLE) {
        _safeMintWithMeta(to, uri, eventId, paymentId, bytes32(0), address(0), 0);
    }

    /**
     * @dev Backward-compatible overload that sets full ticket metadata at mint time.
     */
    function safeMint(
        address to,
        string memory uri,
        uint256 eventId,
        bytes32 paymentId,
        bytes32 rulesHash,
        address payoutSplitter,
        uint8 transferPolicy
    ) public onlyRole(MINTER_ROLE) {
        _safeMintWithMeta(to, uri, eventId, paymentId, rulesHash, payoutSplitter, transferPolicy);
    }

    /**
     * @dev Allows the owner of a ticket to mark it as 'claimed'.
     * @param tokenId The ID of the token to claim.
     */
    function claim(uint256 tokenId) external {
        require(_requireOwned(tokenId) == msg.sender, "EventTicket: Caller is not the owner of the token");
        TicketMeta storage ticket = tickets[tokenId];
        require(!_isClosed(ticket.eventId, ticket.eventState), "EventTicket: Event is closed");

        ticket.claimed = true;
        if (ticket.eventState == EventState.CREATED || ticket.eventState == EventState.ACTIVE) {
            ticket.eventState = EventState.CHECKIN;
        }
    }

    /**
     * @dev Updates global state for an eventId. CLOSED state locks mint/claim/transfer.
     */
    function setEventState(uint256 eventId, EventState newState) external onlyRole(DEFAULT_ADMIN_ROLE) {
        eventStates[eventId] = newState;
    }

    /**
     * @dev Optional per-ticket state override for emergency/admin flows.
     */
    function setTicketEventState(uint256 tokenId, EventState newState) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _requireOwned(tokenId);
        tickets[tokenId].eventState = newState;
    }

    /**
     * @dev Returns the next token ID that will be minted.
     */
    function nextTokenId() external view returns (uint256) {
        return _tokenIdCounter;
    }

    /**
     * @dev Returns the paymentId associated with a token.
     */
    function paymentIdOf(uint256 tokenId) external view returns (bytes32) {
        _requireOwned(tokenId);
        return _tokenPaymentIds[tokenId];
    }

    function _safeMintWithMeta(
        address to,
        string memory uri,
        uint256 eventId,
        bytes32 paymentId,
        bytes32 rulesHash,
        address payoutSplitter,
        uint8 transferPolicy
    ) internal {
        require(eventStates[eventId] != EventState.CLOSED, "EventTicket: Event is closed");
        require(!usedPaymentIds[paymentId], "EventTicket: Payment ID has already been used");
        usedPaymentIds[paymentId] = true;

        uint256 tokenId = _tokenIdCounter;
        unchecked {
            _tokenIdCounter = tokenId + 1;
        }
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);

        tickets[tokenId] = TicketMeta({
            eventId: eventId,
            claimed: false,
            rulesHash: rulesHash,
            payoutSplitter: payoutSplitter,
            transferPolicy: transferPolicy,
            eventState: EventState.ACTIVE
        });
        _tokenPaymentIds[tokenId] = paymentId;
        eventStates[eventId] = EventState.ACTIVE;
    }

    function _isClosed(uint256 eventId, EventState ticketState) internal view returns (bool) {
        return ticketState == EventState.CLOSED || eventStates[eventId] == EventState.CLOSED;
    }

    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) {
            TicketMeta storage ticket = tickets[tokenId];
            require(!_isClosed(ticket.eventId, ticket.eventState), "EventTicket: Event is closed");
        }
        return super._update(to, tokenId, auth);
    }

    // The following functions are overrides required by Solidity because of multiple inheritance.

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        _requireOwned(tokenId);
        return super.tokenURI(tokenId);
    }
    
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
