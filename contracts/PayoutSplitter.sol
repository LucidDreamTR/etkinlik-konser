// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract PayoutSplitter {
    error LengthMismatch();
    error InvalidTotal();
    error TransferFailed(address recipient, uint256 amount);

    bool private locked;

    modifier nonReentrant() {
        if (locked) revert("ReentrancyGuard: reentrant call");
        locked = true;
        _;
        locked = false;
    }

    function distribute(address[] calldata recipients, uint256[] calldata amounts)
        external
        payable
        nonReentrant
    {
        if (recipients.length != amounts.length) revert LengthMismatch();

        uint256 total;
        for (uint256 i; i < amounts.length;) {
            total += amounts[i];
            unchecked {
                ++i;
            }
        }

        if (total != msg.value) revert InvalidTotal();

        for (uint256 i; i < recipients.length;) {
            (bool success, ) = recipients[i].call{value: amounts[i]}("");
            if (!success) revert TransferFailed(recipients[i], amounts[i]);
            unchecked {
                ++i;
            }
        }
    }
}
