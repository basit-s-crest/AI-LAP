-- Redefine encrypt/decrypt functions using pgcrypto's pgp_sym_encrypt/decrypt
-- This is a fallback/replacement for pgsodium since pgsodium is not enabled.

CREATE OR REPLACE FUNCTION encrypt_phi_field(plaintext text, key_phrase text)
RETURNS bytea LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN pgp_sym_encrypt(plaintext, key_phrase);
END;
$$;

CREATE OR REPLACE FUNCTION decrypt_phi_field(ciphertext bytea, key_phrase text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN pgp_sym_decrypt(ciphertext, key_phrase);
END;
$$;
