// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract CertificateNFT is ERC721, ERC721URIStorage, Ownable {
    uint256 private _nextTokenId;

    // Certificate metadata structure
    struct Certificate {
        string kraPin;
        string sessionId;
        uint256 issueDate;
        bool isValid;
    }

    // Mapping from token ID to Certificate
    mapping(uint256 => Certificate) public certificates;
    
    // Mapping from PIN to token IDs
    mapping(string => uint256[]) public pinToCertificates;

    event CertificateIssued(uint256 indexed tokenId, string kraPin, string sessionId);
    event CertificateValidityChanged(uint256 indexed tokenId, bool isValid);

    constructor() ERC721("Filing Certificate", "FCERT") Ownable() {}

    function safeMint(
        address to,
        string memory kraPin,
        string memory sessionId,
        string memory uri
    ) public onlyOwner returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);

        certificates[tokenId] = Certificate({
            kraPin: kraPin,
            sessionId: sessionId,
            issueDate: block.timestamp,
            isValid: true
        });

        pinToCertificates[kraPin].push(tokenId);

        emit CertificateIssued(tokenId, kraPin, sessionId);
        return tokenId;
    }

    function setCertificateValidity(uint256 tokenId, bool isValid) public onlyOwner {
        require(_exists(tokenId), "Certificate does not exist");
        certificates[tokenId].isValid = isValid;
        emit CertificateValidityChanged(tokenId, isValid);
    }

    function getCertificatesByPin(string memory kraPin) public view returns (uint256[] memory) {
        return pinToCertificates[kraPin];
    }

    function getCertificate(uint256 tokenId) public view returns (
        string memory kraPin,
        string memory sessionId,
        uint256 issueDate,
        bool isValid
    ) {
        require(_exists(tokenId), "Certificate does not exist");
        Certificate memory cert = certificates[tokenId];
        return (cert.kraPin, cert.sessionId, cert.issueDate, cert.isValid);
    }

    // Required overrides
    function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
    }

    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
