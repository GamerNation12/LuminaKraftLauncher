use tauri::{AppHandle, Emitter, State};
use std::process::{Command, Stdio, ChildStdin};
use std::io::{BufReader, BufRead, Write};
use std::thread;
use std::sync::Mutex;

pub struct CoreState(pub Mutex<Option<ChildStdin>>);

#[tauri::command]
pub async fn start_nebula_core(app: AppHandle, state: State<'_, CoreState>) -> Result<String, String> {
    // The exact path built by Qt Creator
    let exe_path = r"C:\Users\minec\Documents\GitHub\LuminaKraftLauncher\cpp-core\build_final\NebulaCore.exe";
    
    let mut child = match Command::new(exe_path)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .spawn() {
            Ok(c) => c,
            Err(e) => return Err(format!("Failed to spawn NebulaCore: {}", e)),
        };

    let stdin = child.stdin.take().expect("Failed to open stdin");
    let stdout = child.stdout.take().expect("Failed to open stdout");

    // Save stdin so we can write to it later
    *state.0.lock().unwrap() = Some(stdin);

    let app_handle = app.clone();
    thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines() {
            if let Ok(line_content) = line {
                println!("NebulaCore Output: {}", line_content);
                // Emit event to React Frontend!
                let _ = app_handle.emit("nebula-core-event", line_content);
            }
        }
    });

    Ok("NebulaCore connected".to_string())
}

#[tauri::command]
pub async fn send_nebula_command(command_json: String, state: State<'_, CoreState>) -> Result<(), String> {
    let mut stdin_guard = state.0.lock().unwrap();
    if let Some(stdin) = stdin_guard.as_mut() {
        if let Err(e) = writeln!(stdin, "{}", command_json) {
            return Err(format!("Failed to write to core: {}", e));
        }
        Ok(())
    } else {
        Err("NebulaCore is not running".to_string())
    }
}
