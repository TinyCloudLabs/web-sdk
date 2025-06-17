use std::{collections::HashMap, str::FromStr};

use iri_string::types::UriString;
use js_sys::{JsString, JSON};
use serde_json::Value;
use tinycloud_sdk_rs::tinycloud_lib::{
    cacaos::siwe::{generate_nonce, Message, Version as SiweVersion},
    siwe_recap::{Ability, Capability},
    ssi::{
        dids::DIDKey,
        // did::{DIDMethod, Source},
        jwk::JWK,
        // vc::get_verification_method,
    },
};
use wasm_bindgen::prelude::*;
use web_sys::{console::error_1 as console_error, console::error_2 as console_error_2};

// use crate::session::*;

use super::types::*;

use tinycloud_sdk_rs::session::Session;

#[derive(Debug, Default)]
pub struct SessionInfo {
    key: Option<JWK>,
    session: Option<Session>,
}

#[derive(Debug)]
pub struct SessionManager {
    sessions: HashMap<String, SessionInfo>,
    capability: Capability<Value>,
}

static DEFAULT_KEY_ID: &str = "default";

/// Builds an TCWSession.
impl SessionManager {
    /// Initialize a new SessionManager.
    pub fn new() -> Result<SessionManager, String> {
        let key_id = DEFAULT_KEY_ID.to_string();
        let mut sessions: HashMap<String, SessionInfo> = HashMap::new();
        let mut default_key: JWK = JWK::generate_ed25519()
            .map_err(|error| format!("failed to generate session key: {}", error))?;

        // add key_id to jwk
        default_key.key_id = Some(key_id.clone());

        sessions.insert(
            key_id,
            SessionInfo {
                key: Some(default_key),
                session: None,
            },
        );
        Ok(Self {
            sessions,
            capability: Capability::default(),
        })
    }

    // reset the builder
    pub fn reset_capability(&mut self) {
        self.capability = Capability::default();
    }

    /// Build a SIWE message for signing.
    pub async fn build(
        self,
        config: SiweConfig,
        key_id: Option<String>,
        custom_uri: Option<String>,
    ) -> Result<String, JsValue> {
        let did_uri_string = match custom_uri {
            Some(uri) => uri,
            None => self.get_did(key_id).await?,
        };

        let uri = iri_string::types::UriString::from_str(&did_uri_string)
            .map_err(|e| format!("Failed to convert URI string to RiString: {}", e))?;

        let domain = config
            .domain()
            .parse()
            .map_err(|e| format!("failed to parse the domain as an authority: {}", e))?;
        let address = crate::session::util::hex_to_bytes(&config.address())?;
        let nonce = config.nonce().unwrap_or_else(generate_nonce);
        let parse_date_err = |e| format!("unable to parse timestamp from string: {}", e);
        let issued_at = config.issuedAt().parse().map_err(parse_date_err)?;
        let expiration_time = config
            .expirationTime()
            .map(|s| s.parse().map_err(parse_date_err))
            .transpose()?;
        let not_before = config
            .notBefore()
            .map(|s| s.parse().map_err(parse_date_err))
            .transpose()?;
        let resources = config
            .resources()
            .unwrap_or_default()
            .iter()
            .map(|js_string| js_string.as_string())
            .map(|s: Option<String>| match s {
                Some(string) => string
                    .parse()
                    .map_err(|e| format!("unable to parse resource as uri: {}", e).into()),
                None => Err("error converting UTF-16 to UTF-8".into()),
            })
            .collect::<Result<Vec<_>, JsValue>>()?;
        let message = Message {
            domain,
            address,
            statement: config.statement(),
            uri,
            version: SiweVersion::V1,
            chain_id: config.chainId() as u64,
            nonce,
            issued_at,
            expiration_time,
            not_before,
            request_id: config.requestId(),
            resources,
        };

        let siwe = self
            .capability
            .build_message(message)
            .map_err(|build_error| format!("unable to build siwe message: {}", build_error))?;
        Ok(siwe.to_string())
    }

    /// Add default actions to a capability.
    pub fn add_default_actions(&mut self, namespace: &str, default_actions: Vec<JsString>) -> bool {
        let actions: Vec<String> = if let Some(actions) = default_actions
            .iter()
            .map(|js_string| js_string.as_string())
            .collect()
        {
            actions
        } else {
            string_conversion_error();
            return false;
        };

        for action in actions {
            // Format the namespace as a URI pattern and parse it
            let target = format!("{}:*", namespace);
            // Parse the target string into a URI
            let target_uri = match target.parse::<UriString>() {
                Ok(uri) => uri,
                Err(e) => {
                    console_error(&format!("Failed to parse URI: {}", e).into());
                    return false;
                }
            };

            // Convert action string to &str to satisfy trait bounds
            if let Err(e) = self.capability.with_action_convert(
                target_uri,
                action.as_str(), // Use as_str() instead of &action
                Vec::<std::collections::BTreeMap<String, Value>>::new(),
            ) {
                console_error(&format!("Failed to add action: {}", e).into());
                return false;
            }
        }
        true
    }

    /// Add actions for a specific target to a capability.
    pub fn add_targeted_actions(
        &mut self,
        namespace: &str,
        target: String,
        actions: Vec<JsString>,
    ) -> bool {
        let actions: Vec<String> = if let Some(actions) = actions
            .iter()
            .map(|js_string| js_string.as_string())
            .collect()
        {
            actions
        } else {
            string_conversion_error();
            return false;
        };

        // Create a properly formatted resource URI
        let resource = format!("{}:{}", namespace, target);

        for action in actions {
            if let Err(e) = self.capability.with_action_convert(
                resource.parse::<UriString>().unwrap(),
                action.parse::<Ability>().unwrap(),
                Vec::<std::collections::BTreeMap<String, Value>>::new(),
            ) {
                console_error(&format!("Failed to add targeted action: {}", e).into());
                return false;
            }
        }
        true
    }

    pub fn create_session_key(&mut self, key_id: Option<String>) -> Result<String, String> {
        let key_id = key_id.unwrap_or(DEFAULT_KEY_ID.to_string());
        if self.sessions.contains_key(&key_id) {
            return Err(format!("key already exists: {}", key_id));
        }
        let mut new_key: JWK = JWK::generate_ed25519()
            .map_err(|error| format!("failed to generate session key: {}", error))?;

        // add key_id to jwk
        new_key.key_id = Some(key_id.clone());

        self.sessions.insert(
            key_id.clone(),
            SessionInfo {
                key: Some(new_key),
                session: None,
            },
        );
        Ok(key_id)
    }

    pub fn import_session_key(
        &mut self,
        mut key: JWK,
        key_id: Option<String>,
        override_key_id: bool,
    ) -> Result<String, String> {
        let key_id = key_id.unwrap_or(DEFAULT_KEY_ID.to_string());
        if self.sessions.contains_key(&key_id) && !override_key_id {
            return Err(format!("key already exists: {}", key_id));
        }

        // add "kid" to jwk
        key.key_id = Some(key_id.clone());

        self.sessions.insert(
            key_id.clone(),
            SessionInfo {
                key: Some(key),
                session: None,
            },
        );
        Ok(key_id)
    }

    pub fn list_session_keys(&self) -> Vec<String> {
        let keys = self.sessions.keys().cloned().collect();
        keys
    }

    pub fn rename_session_key_id(
        &mut self,
        old_key_id: String,
        new_key_id: String,
    ) -> Result<(), String> {
        if !self.sessions.contains_key(&old_key_id) {
            return Err(format!("Key {} does not exist.", old_key_id));
        }
        if self.sessions.contains_key(&new_key_id) {
            return Err(format!("Key {} already exists.", new_key_id));
        }
        if let Some(session_info) = self.sessions.remove(&old_key_id) {
            self.sessions.insert(new_key_id, session_info);
        }
        Ok(())
    }

    pub async fn get_did(&self, key_id: Option<String>) -> Result<String, String> {
        let did = DIDKey::generate(&self.get_private_key(key_id)?)
            .map_err(|e| format!("unable to generate the DID of the session key: {e}"))?;
        // let did_vm = get_verification_method(&did, &didkey).await.ok_or(format!(
        //     "unable to generate the DID verification method from the DID '{}'",
        //     &did
        // ))?;
        // let uri = did_vm.parse().map_err(|e| {
        //     format!(
        //         "failed to parse the DID verification method as a URI: {}",
        //         e
        //     )
        // })?;
        Ok(did.to_string())
    }

    fn get_private_key(&self, key_id: Option<String>) -> Result<JWK, String> {
        let key_id = key_id.unwrap_or(DEFAULT_KEY_ID.to_string());
        let session_info = self
            .sessions
            .get(&key_id)
            .ok_or(format!("key not found: {}", key_id))?;
        if let Some(key) = &session_info.key {
            Ok(key.clone())
        } else {
            Err(format!("private key not found for key_id: {}", key_id))
        }
    }

    pub fn jwk(&self, key_id: Option<String>) -> Option<String> {
        match serde_json::to_string(&self.get_private_key(key_id).unwrap()) {
            Ok(s) => Some(s),
            Err(e) => {
                console_error(&e.to_string().into());
                None
            }
        }
    }

    pub fn update_session(
        &mut self,
        session: Session,
        key_id: Option<String>,
    ) -> Result<(), String> {
        let final_key_id = key_id
            .or(session.jwk.key_id.clone())
            .ok_or("No key_id provided")?;

        let session_info = self.sessions.entry(final_key_id).or_default();

        session_info.session = Some(session);

        Ok(())
    }
}

fn string_conversion_error() {
    console_error(&"error converting UTF-16 into UTF-8".into());
}

#[cfg(test)]
pub mod test {
    use super::*;
    use ssi::jwk::JWK;
    use std::collections::HashSet;

    #[tokio::test]
    async fn test_new_session_key_manager() {
        let manager = SessionManager::new();
        assert!(manager.is_ok());
        let manager = manager.unwrap();
        let keys = manager.list_session_keys();
        assert_eq!(keys.len(), 1);
    }

    #[tokio::test]
    async fn test_create_session_key() {
        let mut manager = SessionManager::new().unwrap();
        let result = manager.create_session_key(Some("custom_key".to_string()));
        assert!(result.is_ok());
        assert!(manager.sessions.contains_key("custom_key"));
    }

    #[tokio::test]
    async fn test_create_duplicate_session_key() {
        let mut manager = SessionManager::new().unwrap();
        let _ = manager.create_session_key(Some("custom_key".to_string()));
        let result = manager.create_session_key(Some("custom_key".to_string()));
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_import_session_key() {
        let mut manager = SessionManager::new().unwrap();
        let key = JWK::generate_ed25519().unwrap();
        let result = manager.import_session_key(key, Some("imported_key".to_string()), false);
        assert!(result.is_ok());
        assert!(manager.sessions.contains_key("imported_key"));
    }

    #[tokio::test]
    async fn test_list_session_keys() {
        let mut manager = SessionManager::new().unwrap();
        let _ = manager.create_session_key(Some("custom_key".to_string()));
        let keys = manager.list_session_keys();
        let mut key_set = HashSet::new();
        key_set.insert("default".to_string());
        key_set.insert("custom_key".to_string());
        assert_eq!(keys.into_iter().collect::<HashSet<_>>(), key_set);
    }

    #[tokio::test]
    async fn test_rename_session_key_id() {
        let mut manager = SessionManager::new().unwrap();
        let result =
            manager.rename_session_key_id("default".to_string(), "renamed_key".to_string());
        assert!(result.is_ok());
        assert!(!manager.sessions.contains_key("default"));
        assert!(manager.sessions.contains_key("renamed_key"));
    }

    #[tokio::test]
    async fn test_rename_nonexistent_session_key_id() {
        let mut manager = SessionManager::new().unwrap();
        let result =
            manager.rename_session_key_id("nonexistent_key".to_string(), "new_key".to_string());
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_get_did() {
        let manager = SessionManager::new().unwrap();
        let result = manager.get_did(None).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_get_private_key() {
        let manager = SessionManager::new().unwrap();
        let result = manager.get_private_key(None);
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_jwk() {
        let manager = SessionManager::new().unwrap();
        let result = manager.jwk(None);
        assert!(result.is_some());
        let jwk = result.unwrap();
        assert!(jwk.contains("crv\":\"Ed25519\""));
    }

    #[tokio::test]
    async fn test_import_existing_session_key_without_override() {
        let mut manager = SessionManager::new().unwrap();
        let key = JWK::generate_ed25519().unwrap();
        let result =
            manager.import_session_key(key.clone(), Some("imported_key".to_string()), false);
        assert!(result.is_ok());
        let result = manager.import_session_key(key, Some("imported_key".to_string()), false);
        assert!(result.is_err()); // expect error because override is false
    }

    // #[tokio::test]
    // async fn test_update_session() {
    //     let mut manager = SessionManager::new().unwrap();

    //     let session = Default::default();
    //     let result = manager.update_session(session, Some("default".to_string()));
    //     assert!(result.is_ok());

    //     // Check if session info is stored properly
    //     if let Some(session_info) = manager.sessions.get("default") {
    //         assert!(session_info.session.is_some());
    //         assert_eq!(session_info.session.as_ref().unwrap().id, "session1");
    //         assert_eq!(session_info.session.as_ref().unwrap().timestamp, 123456);
    //     } else {
    //         panic!("Session not found");
    //     }
    // }
}
