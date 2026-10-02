// Крошечный запускатель Clawds.exe: проверяет Node.js, запускает сервер и открывает интерфейс в браузере.
// Закрытие окна останавливает сервер. Сборка: scripts/build-release.mjs (csc из .NET Framework, есть в Windows).
using System;
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.Net.Sockets;
using System.Threading;

static class Clawds
{
    const int Port = 8787;

    static bool PortOpen()
    {
        try { using (var c = new TcpClient()) { var r = c.BeginConnect("127.0.0.1", Port, null, null); return r.AsyncWaitHandle.WaitOne(300) && c.Connected; } }
        catch { return false; }
    }

    static void Open() { Process.Start(new ProcessStartInfo("http://127.0.0.1:" + Port) { UseShellExecute = true }); }

    static int Fail(string text)
    {
        Console.WriteLine(text);
        Console.WriteLine("Press Enter to close.");
        Console.ReadLine();
        return 1;
    }

    static int Main()
    {
        Console.Title = "Clawds";
        string dir = AppDomain.CurrentDomain.BaseDirectory;
        string script = Path.Combine(dir, "server", "index.mjs");
        if (!File.Exists(script)) return Fail("server\\index.mjs not found next to Clawds.exe. Unpack the whole archive and run Clawds.exe from its folder.");

        if (PortOpen()) { Console.WriteLine("Clawds is already running, opening the browser."); Open(); return 0; }

        var psi = new ProcessStartInfo("node", "\"" + script + "\"") { WorkingDirectory = dir, UseShellExecute = false };
        Process server;
        try { server = Process.Start(psi); }
        catch (Win32Exception)
        {
            try { Process.Start(new ProcessStartInfo("https://nodejs.org/en/download") { UseShellExecute = true }); } catch { }
            return Fail("Node.js 20 or newer is required and was not found. The download page was opened; install it and run Clawds.exe again.");
        }

        for (int i = 0; i < 60 && !server.HasExited && !PortOpen(); i++) Thread.Sleep(250);
        if (server.HasExited) return Fail("The server stopped right after start. See the messages above.");
        Console.WriteLine("Clawds is running at http://127.0.0.1:" + Port + "  (close this window to stop it)");
        Open();
        server.WaitForExit();
        return server.ExitCode;
    }
}
