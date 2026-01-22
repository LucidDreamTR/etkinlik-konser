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

    mapping(bytes32 => bool) public usedPaymentIds;

    struct TicketMeta {
        uint256 eventId;
        bool claimed;
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
    function safeMint(address to, string memory uri, uint256 eventId, bytes32 paymentId)
        public
        onlyRole(MINTER_ROLE)
    {
        require(!usedPaymentIds[paymentId], "EventTicket: Payment ID has already been used");
        usedPaymentIds[paymentId] = true;

        uint256 tokenId = _tokenIdCounter;
        unchecked {
            _tokenIdCounter = tokenId + 1;
        }
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);

        tickets[tokenId] = TicketMeta({ eventId: eventId, claimed: false });
    }

    /**
     * @dev Allows the owner of a ticket to mark it as 'claimed'.
     * @param tokenId The ID of the token to claim.
     */
    function claim(uint256 tokenId) external {
        require(_requireOwned(tokenId) == msg.sender, "EventTicket: Caller is not the owner of the token");
        tickets[tokenId].claimed = true;
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
