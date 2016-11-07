const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Lang = imports.lang;
const St = imports.gi.St;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const ExtensionUtils = imports.misc.extensionUtils;

const Me = ExtensionUtils.getCurrentExtension();
const password_store_dir = GLib.build_filenamev([GLib.get_home_dir(), '.password-store']);

const extension_icon = 'dialog-password-symbolic';
const key_icon = 'dialog-password';
const folder_icon = 'folder';
const folder_open_icon = 'folder-open';

const MenuItem = new Lang.Class({
  Name: 'MenuItem',
  Extends: PopupMenu.PopupMenuItem,
  _init: function (icon, text) {
    this.parent(text);
    let icon = new St.Icon({ icon_name: icon, icon_size: 24 });
    this.actor.insert_child_at_index(icon, 1);
  },
});

const PasswordStoreManager = new Lang.Class({
  Name: 'PasswordStoreManager',
  Extends: PanelMenu.Button,
  parent_dir: '/',
  current_dir: '/',

  _init: function() {
    PanelMenu.Button.prototype._init.call(this, 0.0);
    let hbox = new St.BoxLayout({ style_class: 'panel-status-menu-box' });
    let icon = new St.Icon({ icon_name: extension_icon, style_class: 'system-status-icon'});

    hbox.add_child(icon);
    this.actor.add_actor(hbox);
    Main.panel.addToStatusArea('password_store_manager', this);
    this._draw_popup_menu();
  },

  _draw_popup_menu: function() {
    this.menu.removeAll();

    this.parent_dir = GLib.path_get_dirname(this.current_dir);

    //log("parent_dir: " + this.parent_dir);
    //log("current_dir: " + this.current_dir);
    //log("current_dir != parent_dir: " + (this.current_dir != this.parent_dir));

    // Add an item to access the parent directory
    if (this.parent_dir != this.current_dir)
    {
      let item = new MenuItem(folder_icon, '..');
      item.connect('activate', Lang.bind(this, function() {
        this.current_dir = this.parent_dir;
        this._draw_popup_menu();
      }));

      this.menu.addMenuItem(item);
    }

    // Add an item to indicate the current directory if not root
    if (this.current_dir != '/')
    {
      // Current directory
      let menu_entry = new MenuItem(folder_open_icon, GLib.path_get_basename(this.current_dir));
      menu_entry.connect('activate', Lang.bind(this, function() {
        this._draw_popup_menu();
      }));
      this.menu.addMenuItem(menu_entry);
    }

		let files;
		let dir = Gio.File.new_for_path(GLib.build_filenamev([password_store_dir, this.current_dir]));

		try
    {
			files = dir.enumerate_children('standard::name,standard::type', Gio.FileQueryInfoFlags.NONE, null);
		}
    catch (e)
    {
  		files = null;
		}

    if (files)
    {
      let file;
      let folders = [];
      let keys = [];
      while ((file = files.next_file(null)))
      {
        let filetype = file.get_file_type();
        let filename = file.get_name();

        // Skip dotfiles
        if (!GLib.pattern_match_simple('.*', filename))
        {
          if (filetype == Gio.FileType.REGULAR && GLib.pattern_match_simple('*.gpg', filename))
          {
            // Insert filename without .gpg extension
            keys.push(/(.*)[.]gpg/.exec(filename)[1]);
          }
          else if (filetype == Gio.FileType.DIRECTORY)
          {
            folders.push(filename);
          }
        }
      }

      if (folders.length > 0)
      {
        folders.sort().forEach(item => {
          let menu_entry = new MenuItem(folder_icon, item);
          menu_entry.connect('activate', Lang.bind(this, function() {
            this.current_dir = GLib.build_filenamev([this.current_dir, item]);
            this._draw_popup_menu();
          }));
          this.menu.addMenuItem(menu_entry);
        });
      }

      if (keys.length > 0)
      {
        keys.sort().forEach(item => {
          let menu_entry = new MenuItem(key_icon, item);
          menu_entry.connect('activate', Lang.bind(this, function() {
            let cmd2 = "pass -c " + GLib.build_filenamev([this.current_dir, item]);
            let out = GLib.spawn_command_line_async(cmd2);
          }));
          this.menu.addMenuItem(menu_entry);
       });
      }
    }
  }
});

let password_store_manager;

function enable() {
  password_store_manager = new PasswordStoreManager();
}

function disable() {
  password_store_manager.destroy();
}
