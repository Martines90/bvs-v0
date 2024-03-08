// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9;

library ContractError {
    /*
    Here I have taken first 8 letters from Kekkac256 hash to represent the error:
    NotOwner()          -->   30cd7471
    InvalidAddress()    -->   e6c4247b
    AlreadyUnpaused()   -->   98b904cd
    AlreadyPaused()     -->   1785c681
    LengthMismatch()    -->   ff633a38
  */
    error Err(bytes8);
}
