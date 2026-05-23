use std::path::PathBuf;
use zed_extension_api::{node_binary_path, register_extension, Command, Extension, Result as ZedResult};

struct ImportSizeExtension;

impl Extension for ImportSizeExtension {
    fn new() -> Self {
        Self
    }

    fn language_server_command(
        &mut self,
        _language_server_id: &zed_extension_api::LanguageServerId,
        _worktree: &zed_extension_api::Worktree,
    ) -> ZedResult<Command> {
        let node = node_binary_path()?;
        let lsp_entry = resolve_lsp_entry()?;

        Ok(Command {
            command: node,
            args: vec![path_to_string(lsp_entry), "--stdio".to_string()],
            env: vec![],
        })
    }
}

fn path_to_string(path: PathBuf) -> String {
    path.to_string_lossy().into_owned()
}

fn resolve_lsp_entry() -> ZedResult<PathBuf> {
    let extension_root = std::env::current_dir().map_err(|error| error.to_string())?;

    // Cross-platform fallback: if running from `<extensions>/work/<id>`, resolve
    // to `<extensions>/installed/<id>`.
    if let (Some(extension_id), Some(work_dir), Some(extensions_dir)) = (
        extension_root.file_name(),
        extension_root.parent(),
        extension_root.parent().and_then(|parent| parent.parent()),
    ) {
        if work_dir.file_name().is_some_and(|name| name == "work") {
            return Ok(extensions_dir
                .join("installed")
                .join(extension_id)
                .join("lsp-server")
                .join("dist")
                .join("server.js"));
        }
    }

    Ok(extension_root.join("lsp-server").join("dist").join("server.js"))
}

register_extension!(ImportSizeExtension);
