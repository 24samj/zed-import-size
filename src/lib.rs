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

    let root_str = extension_root.to_string_lossy();
    if root_str.contains("/extensions/work/import-size") {
        let installed_root_str = root_str.replace("/extensions/work/import-size", "/extensions/installed/import-size");
        return Ok(
            PathBuf::from(installed_root_str)
                .join("lsp-server")
                .join("dist")
                .join("server.js"),
        );
    }

    Ok(extension_root.join("lsp-server").join("dist").join("server.js"))
}

register_extension!(ImportSizeExtension);
