use hex::FromHex;

pub fn hex_to_bytes<const N: usize>(hex: &str) -> Result<[u8; N], String>
where
    [u8; N]: FromHex,
    <[u8; N] as FromHex>::Error: std::fmt::Display,
{
    <[u8; N]>::from_hex(hex.strip_prefix("0x").unwrap_or(hex))
        .map_err(|e| format!("failed to parse '{}' as a hexstring: {}", hex, e))
}
