ProcessDraw
-----------

**ProcessDraw** is a desktop PFD and P&ID editor for process engineers, built on draw.io desktop:
ISO 10628 / ISA 5.1 / IEC 62424 symbol libraries with engineering data, automatic tag and line
numbering, multi-sheet projects with linked off-page connectors, PFD stream tables (H&MB), Excel
equipment/line/instrument/valve lists, a project checker and drawing sheets with title blocks and
revisions. All features are in the **ProcessDraw** menu.

```bash
npm install
npm start
```

See [PROCESSDRAW.md](PROCESSDRAW.md) for setup, code layout and tests, and [TODO.md](TODO.md) for the
roadmap.

License
-------

ProcessDraw is free software, licensed under the **GNU General Public License v3 only** (see
[LICENSE](LICENSE)) and provided WITHOUT ANY WARRANTY. If you give a copy of ProcessDraw to anyone,
you must also give them the complete source code under the same license (GPL v3 section 6).

ProcessDraw is a modified version of:

- [drawio-desktop](https://github.com/jgraph/drawio-desktop), GPL v3, copyright draw.io Ltd
- [draw.io](https://github.com/jgraph/drawio) in `drawio/`, Apache 2.0 (see
  [drawio/LICENSE](drawio/LICENSE)), copyright JGraph Holdings Ltd / draw.io Ltd and draw.io AG

[NOTICE](NOTICE) lists the third-party components and the upstream files ProcessDraw changed.

Trademark
---------

draw.io is a registered EU trademark (#018062448) of draw.io Ltd. ProcessDraw is an independent
project and is not affiliated with, endorsed by or sponsored by draw.io. The name draw.io is used
here only to describe where the code comes from and the `.drawio` file format ProcessDraw reads and
writes. ProcessDraw does not use the draw.io logo.
