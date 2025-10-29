use anchor_client::solana_sdk::{signature::Keypair as SolanaKeypair, signer::Signer};
use const_crypto::sha2::Sha256;
use rand::{rngs::StdRng, SeedableRng};
use x25519_dalek::{EphemeralSecret, PublicKey, ReusableSecret};

pub type X25519PublicKey = PublicKey;
pub type X25519EphemeralSecret = EphemeralSecret;
pub type X25519ReusableSecret = ReusableSecret;

pub fn gen_encryption_priv_key_from_solana_kp(kp: &SolanaKeypair) -> X25519ReusableSecret {
    let public_key_bytes = kp.pubkey().to_bytes();
    let secret_key_bytes = kp.secret().to_bytes();

    // Combine public and secret key bytes
    let combined_bytes: Vec<u8> = public_key_bytes
        .iter()
        .chain(secret_key_bytes.iter())
        .cloned()
        .collect();

    // Create a SHA-256 hash of the combined bytes
    let hash = Sha256::new().update(&combined_bytes).finalize();
    gen_encryption_priv_key_from_seed(&hash)
}

pub fn gen_encryption_priv_key_from_seed(seed: &[u8; 32]) -> X25519ReusableSecret {
    let rng = StdRng::from_seed(*seed);
    X25519ReusableSecret::random_from_rng(rng)
}

pub fn gen_random_priv_key() -> X25519EphemeralSecret {
    let rng = StdRng::from_entropy();
    X25519EphemeralSecret::random_from_rng(rng)
}

pub fn get_pub_key(private_key: &X25519ReusableSecret) -> [u8; 32] {
    X25519PublicKey::from(private_key).to_bytes()
}

pub fn get_pub_key_eph(private_key: &X25519EphemeralSecret) -> [u8; 32] {
    X25519PublicKey::from(private_key).to_bytes()
}

pub fn key_exchange_eph(
    private_key: X25519EphemeralSecret,
    ephemeral_public_key: &[u8; 32],
) -> [u8; 32] {
    private_key
        .diffie_hellman(&X25519PublicKey::from(*ephemeral_public_key))
        .to_bytes()
}

pub fn key_exchange_reusable(
    private_key: &X25519ReusableSecret,
    ephemeral_public_key: &[u8; 32],
) -> [u8; 32] {
    private_key
        .diffie_hellman(&X25519PublicKey::from(*ephemeral_public_key))
        .to_bytes()
}

#[cfg(test)]
mod tests {
    use super::*;
    use rand::{CryptoRng, RngCore};

    #[test]
    fn test_ts_test_vector() {
        let alice_secret_key = X25519EphemeralSecret::random_from_rng(MockRng {
            next_val: [
                0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0A, 0x0B, 0x0C, 0x0D,
                0x0E, 0x0F, 0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18, 0x19, 0x1A, 0x1B,
                0x1C, 0x1D, 0x1E, 0x1F,
            ],
        });
        let alice_secret_key_reusable = X25519ReusableSecret::random_from_rng(MockRng {
            next_val: [
                0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0A, 0x0B, 0x0C, 0x0D,
                0x0E, 0x0F, 0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18, 0x19, 0x1A, 0x1B,
                0x1C, 0x1D, 0x1E, 0x1F,
            ],
        });

        let bob_public_key = [
            0x20, 0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27, 0x28, 0x29, 0x2A, 0x2B, 0x2C, 0x2D,
            0x2E, 0x2F, 0x30, 0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3A, 0x3B,
            0x3C, 0x3D, 0x3E, 0x3F,
        ];

        let encryption_key =
            alice_secret_key.diffie_hellman(&X25519PublicKey::from(bob_public_key));
        let encryption_key_2 =
            alice_secret_key_reusable.diffie_hellman(&X25519PublicKey::from(bob_public_key));

        let expected_shared_secret = [
            108, 35, 132, 242, 192, 241, 58, 143, 243, 206, 238, 85, 7, 85, 64, 119, 140, 217, 249,
            67, 131, 23, 136, 55, 174, 36, 249, 244, 25, 193, 45, 123,
        ];

        assert_eq!(encryption_key.to_bytes(), expected_shared_secret);
        assert_eq!(encryption_key_2.to_bytes(), expected_shared_secret);
    }

    pub struct MockRng {
        pub next_val: [u8; 32],
    }

    impl RngCore for MockRng {
        fn next_u32(&mut self) -> u32 {
            panic!("Not implemented");
        }

        fn next_u64(&mut self) -> u64 {
            panic!("Not implemented");
        }

        // We only use this for deterministic testing
        fn fill_bytes(&mut self, dest: &mut [u8]) {
            dest.copy_from_slice(&self.next_val);
        }

        fn try_fill_bytes(&mut self, _dest: &mut [u8]) -> Result<(), rand::Error> {
            panic!("Not implemented");
        }
    }

    impl CryptoRng for MockRng {}
}
