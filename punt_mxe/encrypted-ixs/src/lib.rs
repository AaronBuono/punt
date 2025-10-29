use arcis_imports::*;

pub const MAX_CIPHERTEXT_WORDS: usize = 18;

#[encrypted]
mod circuits {
    use arcis_imports::*;

    const MAX_CIPHERTEXT_WORDS: usize = 18;

    /// Represents the encrypted bet payload as fixed-size words with a length marker.
    pub struct BetCiphertext {
        used_words: u64,
        ciphertext_words: [u128; MAX_CIPHERTEXT_WORDS],
    }

    #[instruction]
    pub fn store_bet(input_ctxt: Enc<Shared, BetCiphertext>) -> Enc<Shared, ()> {
        let _bet = input_ctxt.to_arcis();
        input_ctxt.owner.from_arcis(())
    }
}
